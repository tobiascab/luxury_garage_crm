const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const arizarService = require('../services/arizarService');
const ArizarSync = require('../services/arizarSync');

// GET /api/appointments/available-slots
router.get('/available-slots', authenticate, async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) return res.status(400).json({ success: false, message: 'startDate y endDate requeridos' });
    const slots = await arizarService.getFreeSlots(startDate, endDate);
    res.json({ success: true, data: slots });
  } catch (err) {
    console.error('Error obteniendo slots de ARIZAR IA:', err.message);
    res.json({ success: true, data: { slots: [] }, message: 'Calendario no disponible temporalmente' });
  }
});

// GET /api/appointments
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { status, date } = req.query;
    const where = {};
    if (req.user.role === 'CLIENT') where.userId = req.user.id;
    if (req.user.role === 'EMPLOYEE') where.employeeId = req.user.id;
    if (status) where.status = status.toUpperCase();

    if (date) {
      // Paraguay = UTC-4
      // "2026-04-02" en Paraguay va de 04:00 UTC hasta el día siguiente 03:59:59 UTC
      const [year, month, day] = date.split('-').map(Number);
      const startUtc = new Date(Date.UTC(year, month - 1, day, 4, 0, 0, 0));       // 00:00 PY = 04:00 UTC
      const endUtc   = new Date(Date.UTC(year, month - 1, day + 1, 3, 59, 59, 999)); // 23:59 PY = 03:59 UTC del día siguiente
      where.startTime = { gte: startUtc, lte: endUtc };
    }

    const appointments = await req.prisma.appointment.findMany({
      where,
      include: { user: { select: { id: true, firstName: true, lastName: true, phone: true } }, vehicle: true, service: true, serviceRecord: true },
      orderBy: { startTime: 'asc' }
    });
    res.json({ success: true, data: appointments });
  } catch (err) { next(err); }
});


// POST /api/appointments — Agendar turno + sync ARIZAR
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { vehicleId, serviceId, date, startTime, notes } = req.body;

    // Validate active membership
    const membership = await req.prisma.membership.findFirst({ where: { userId: req.user.id, status: 'ACTIVE' }, include: { plan: true } });
    if (!membership) return res.status(403).json({ success: false, message: 'Necesitás una membresía activa para agendar' });

    const service = await req.prisma.service.findUnique({ where: { id: serviceId } });
    if (!service) return res.status(404).json({ success: false, message: 'Servicio no encontrado' });

    // ── Timezone fix ────────────────────────────────────────────────────────
    // Frontend sends "2026-03-26T09:00:00" (no TZ) → parsed as UTC by Node.js
    // Paraguay is UTC-4 → must append offset so ARIZAR receives correct local time
    const localStartTime = startTime.includes('+') || startTime.includes('Z') || /T.*-\d{2}:\d{2}$/.test(startTime)
      ? startTime
      : `${startTime}-04:00`;   // Paraguay Standard Time (UTC-4)
    // ────────────────────────────────────────────────────────────────────────

    const start = new Date(localStartTime);
    const end = new Date(start.getTime() + service.durationMinutes * 60000);

    // Crear evento en ARIZAR IA
    const vehicle = await req.prisma.vehicle.findUnique({ where: { id: vehicleId } });
    const user = await req.prisma.user.findUnique({ where: { id: req.user.id } });
    let arizarAppointmentId = null;

    if (user.arizarContactId) {
      try {
        const arizarEvent = await arizarService.createAppointment({
          contactId: user.arizarContactId,
          startTime: localStartTime,
          endTime: end.toISOString(),
          title: `${service.name} - ${vehicle?.brand || ''} ${vehicle?.model || ''} ${vehicle?.licensePlate || ''}`.trim(),
          notes: notes || '',
        });
        arizarAppointmentId = arizarEvent?.id || arizarEvent?.event?.id || null;
        if (arizarAppointmentId) {
          console.log(`✅ ARIZAR CAL: Cita creada OK id=${arizarAppointmentId}`);
        } else {
          console.warn(`⚠️ ARIZAR CAL: createAppointment retornó null (sin arizarContactId o error silencioso)`);
        }
      } catch (err) {
        console.error('Error creando cita en ARIZAR IA:', err.response?.data || err.message);
      }
    }

    // Save to DB
    const appointment = await req.prisma.appointment.create({
      data: { userId: req.user.id, vehicleId, serviceId, date: new Date(date), startTime: start, endTime: end, status: 'CONFIRMED', notes: notes || null, arizarAppointmentId },
      include: { vehicle: true, service: true }
    });

    // ═══ ARIZAR IA: Notify appointment booked ═══
    const sync = new ArizarSync(req.prisma);
    await sync.syncAppointmentBooked(user, appointment);

    res.status(201).json({ success: true, data: appointment });
  } catch (err) { next(err); }
});


// PUT /api/appointments/:id/start — Empleado inicia servicio
router.put('/:id/start', authenticate, authorize('EMPLOYEE', 'ADMIN', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    // Check if service was already started (serviceRecord has @unique on appointmentId)
    const existingRecord = await req.prisma.serviceRecord.findUnique({ where: { appointmentId: req.params.id } });
    if (existingRecord) {
      return res.status(409).json({ success: false, message: 'El servicio ya fue iniciado' });
    }

    const appointment = await req.prisma.appointment.update({
      where: { id: req.params.id },
      data: { status: 'IN_PROGRESS', employeeId: req.user.id },
      include: { user: true, vehicle: true, service: true }
    });
    await req.prisma.serviceRecord.create({ data: { appointmentId: req.params.id, employeeId: req.user.id, startedAt: new Date() } });

    // ═══ ARIZAR IA: Update appointment status ═══
    if (appointment.arizarAppointmentId) {
      try { await arizarService.updateAppointment(appointment.arizarAppointmentId, { appointmentStatus: 'confirmed' }); } catch (e) { }
    }

    // Notify client service started
    if (appointment.user?.arizarContactId) {
      await arizarService.sendWhatsApp(appointment.user.arizarContactId,
        `🚿 ¡Tu servicio ha comenzado!\n\n` +
        `${appointment.service?.name}\n` +
        `🚗 ${appointment.vehicle?.brand} ${appointment.vehicle?.model}\n\n` +
        `Te avisamos cuando esté listo. ⏱️`
      );
    }

    res.json({ success: true, data: appointment });
  } catch (err) { next(err); }
});

// PUT /api/appointments/:id/complete — Empleado completa servicio
router.put('/:id/complete', authenticate, authorize('EMPLOYEE', 'ADMIN', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { notes, vehicleObservations } = req.body;
    const appointment = await req.prisma.appointment.update({
      where: { id: req.params.id },
      data: { status: 'COMPLETED' },
      include: { user: true, vehicle: true, service: true }
    });

    const record = await req.prisma.serviceRecord.findUnique({ where: { appointmentId: req.params.id } });
    let serviceRecord = record;
    if (record) {
      const duration = Math.round((new Date() - new Date(record.startedAt)) / 60000);
      serviceRecord = await req.prisma.serviceRecord.update({ where: { id: record.id }, data: { completedAt: new Date(), durationMinutes: duration, notes, vehicleObservations } });
    }

    // Increment usage with plan limit validation
    const membership = await req.prisma.membership.findFirst({
      where: { userId: appointment.userId, status: 'ACTIVE' },
      include: { plan: true }
    });
    if (membership) {
      // Validar que no exceda el límite de servicios del plan
      if (membership.plan.servicesIncluded && membership.servicesUsed >= membership.plan.servicesIncluded) {
        console.warn(`⚠️ Cliente ${appointment.userId} alcanzó límite de servicios (${membership.servicesUsed}/${membership.plan.servicesIncluded})`);
        // Continúa registrando pero registra en auditoría
        await req.prisma.auditLog.create({
          data: {
            entity: 'membership_overage',
            action: 'SERVICE_LIMIT_EXCEEDED',
            entityId: membership.id,
            userId: appointment.userId,
            detailsJson: { planServicesIncluded: membership.plan.servicesIncluded, servicesUsed: membership.servicesUsed }
          }
        });
      } else {
        // Incrementar solo si no excede límite
        await req.prisma.membership.update({
          where: { id: membership.id },
          data: { servicesUsed: { increment: 1 } }
        });
      }
    }

    // ═══ ARIZAR IA: Full sync on service completion ═══
    const sync = new ArizarSync(req.prisma);
    await sync.syncServiceCompleted(appointment.user, appointment, serviceRecord);

    // Update calendar event status
    if (appointment.arizarAppointmentId) {
      try { await arizarService.updateAppointment(appointment.arizarAppointmentId, { appointmentStatus: 'confirmed' }); } catch (e) { }
    }

    res.json({ success: true, data: appointment });
  } catch (err) { next(err); }
});

// DELETE /api/appointments/:id — Cancelar
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const appointment = await req.prisma.appointment.findFirst({
      where: { id: req.params.id, ...(req.user.role === 'CLIENT' ? { userId: req.user.id } : {}) },
      include: { user: true, vehicle: true, service: true }
    });
    if (!appointment) return res.status(404).json({ success: false, message: 'Turno no encontrado' });

    // Delete from ARIZAR IA calendar
    if (appointment.arizarAppointmentId) {
      try { await arizarService.deleteAppointment(appointment.arizarAppointmentId); } catch (err) { console.error('Error eliminando cita de ARIZAR IA:', err.message); }
    }

    await req.prisma.appointment.update({ where: { id: req.params.id }, data: { status: 'CANCELLED' } });

    // ═══ ARIZAR IA: Notify cancellation ═══
    const sync = new ArizarSync(req.prisma);
    await sync.syncAppointmentCancelled(appointment.user, appointment);

    res.json({ success: true, message: 'Turno cancelado. El slot fue liberado.' });
  } catch (err) { next(err); }
});

module.exports = router;
