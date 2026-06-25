const arizarService = require('./arizarService');

/**
 * ARIZAR IA Sync Service
 * Bidirectional sync between Luxury Garage and ARIZAR IA CRM
 * Includes: custom fields, workflow triggers, full lifecycle tracking
 */
class ArizarSync {
  constructor(prisma) {
    this.prisma = prisma;
  }

  /**
   * Sync user to ARIZAR IA on registration
   * Creates contact, adds tags, creates opportunity, syncs custom fields, triggers workflow
   */
  async syncUserRegistration(user, plan = null) {
    if (!arizarService.isConfigured()) return null;

    try {
      // 1. Upsert contact in CRM
      const contactId = await arizarService.syncNewUser(user, plan);
      if (!contactId) return null;

      // 2. Store contactId in our DB
      await this.prisma.user.update({
        where: { id: user.id },
        data: { arizarContactId: contactId }
      });

      // 3. Create opportunity in pipeline → Stage: 📩 Consulta Recibida
      await arizarService.createOpportunity(contactId, {
        name: `${user.firstName} ${user.lastName} - ${plan?.name || 'Lead'}`,
        value: plan?.priceGs || 0,
      });

      // 4. Sync custom fields
      const vehicles = await this.prisma.vehicle.findMany({ where: { userId: user.id }, take: 2, orderBy: { isPrimary: 'desc' } });
      await arizarService.syncContactCustomFields(contactId, {
        plan: plan?.slug || '',
        planStatus: plan ? 'active' : '',
        planExpiry: '',
        vehicle1: vehicles[0] ? `${vehicles[0].brand} ${vehicles[0].model} ${vehicles[0].year} - ${vehicles[0].licensePlate}` : '',
        vehicle2: vehicles[1] ? `${vehicles[1].brand} ${vehicles[1].model} ${vehicles[1].year} - ${vehicles[1].licensePlate}` : '',
        servicesUsed: 0,
        lastVisit: '',
        walletBalance: 0,
        userId: user.id,
      });

      // 5. Send welcome WhatsApp
      await arizarService.sendWhatsApp(contactId,
        `🚗 ¡Bienvenido a Luxury Garage, ${user.firstName}!\n\n` +
        `Tu cuenta ha sido creada exitosamente.\n` +
        `📧 Email: ${user.email}\n\n` +
        `Accedé a tu portal: https://luxurygarage.arizar-ia.cloud/login\n\n` +
        `¿Necesitás ayuda? Respondé a este mensaje. 💬`
      );

      // 6. Trigger welcome workflow
      await arizarService.triggerWelcomeWorkflow(contactId);

      // 7. Log
      await this._logSync('user_registration', user.id, contactId, { plan: plan?.name });

      console.log(`✅ SYNC: Usuario ${user.email} sincronizado como ${contactId}`);
      return contactId;
    } catch (err) {
      console.error(`❌ SYNC ERROR (user_registration):`, err.message);
      return null;
    }
  }

  /**
   * Sync profile update to CRM
   * Actualiza datos básicos del contacto (firstName/lastName/phone/email) +
   * custom fields del vehículo y del plan activo. Idempotente: upsertContact
   * resuelve el contacto por email, no duplica.
   */
  async syncProfileUpdate(user) {
    if (!user.arizarContactId) return;

    try {
      // 1. Datos básicos del contacto
      await arizarService.upsertContact({
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
      });

      // 2. Vehículos (hasta 2, primario primero)
      const vehicles = await this.prisma.vehicle.findMany({ where: { userId: user.id }, take: 2, orderBy: { isPrimary: 'desc' } });

      // 3. Plan activo (para reflejar plan/estado/vencimiento en el CRM)
      const membership = await this.prisma.membership.findFirst({
        where: { userId: user.id, status: 'ACTIVE' },
        include: { plan: true },
        orderBy: { endDate: 'desc' },
      });

      // 4. Volcar todo a custom fields (solo se envían los keys definidos; el resto se omite)
      await arizarService.syncContactCustomFields(user.arizarContactId, {
        vehicle1: vehicles[0] ? `${vehicles[0].brand} ${vehicles[0].model} ${vehicles[0].year} - ${vehicles[0].licensePlate}` : '',
        vehicle2: vehicles[1] ? `${vehicles[1].brand} ${vehicles[1].model} ${vehicles[1].year} - ${vehicles[1].licensePlate}` : '',
        plan: membership?.plan?.slug || '',
        planStatus: membership ? 'active' : 'inactive',
        planExpiry: membership?.endDate?.toISOString?.() || '',
        userId: user.id,
      });

      await this._logSync('profile_update', user.id, user.arizarContactId, {});
      console.log(`✅ SYNC: Perfil actualizado en CRM para ${user.email}`);
    } catch (err) {
      console.error(`❌ SYNC ERROR (profile_update):`, err.message);
    }
  }

  /**
   * Sync membership activation — tags, custom fields, opportunity, workflow, notification
   */
  async syncMembershipActivated(user, membership) {
    if (!user.arizarContactId) return;

    try {
      const plan = membership.plan || await this.prisma.plan.findUnique({ where: { id: membership.planId } });
      
      // Tags
      await arizarService.updateContactTags(user.arizarContactId, ['miembro-activo', `plan-${plan.slug}`]);
      await arizarService.removeContactTags(user.arizarContactId, ['miembro-inactivo', 'renovacion-pendiente', 'lead']);

      // Custom fields
      await arizarService.syncContactCustomFields(user.arizarContactId, {
        plan: plan.slug,
        planStatus: 'active',
        planExpiry: membership.endDate?.toISOString?.() || '',
      });

      // Notify via WhatsApp
      await arizarService.notifyMembershipActivated(user, plan);

      // Move pipeline → Stage: ✅ Miembro Activo
      await arizarService.moveToMiembro(user.arizarContactId);

      // Contact note
      await arizarService.addContactNote(user.arizarContactId,
        `✅ Membresía activada: ${plan.name}\n📅 ${new Date(membership.startDate).toLocaleDateString('es-PY')} → ${new Date(membership.endDate).toLocaleDateString('es-PY')}`
      );

      // Trigger welcome workflow
      await arizarService.triggerWelcomeWorkflow(user.arizarContactId);

      await this._logSync('membership_activated', user.id, user.arizarContactId, { plan: plan.name, membershipId: membership.id });
      console.log(`✅ SYNC: Membresía ${plan.name} activada para ${user.email}`);
    } catch (err) {
      console.error(`❌ SYNC ERROR (membership_activated):`, err.message);
    }
  }

  /**
   * Sync membership expiration — tags, custom fields, recovery workflow
   */
  async syncMembershipExpired(user, membership) {
    if (!user.arizarContactId) return;

    try {
      const plan = membership.plan || await this.prisma.plan.findUnique({ where: { id: membership.planId } });

      // Tags
      await arizarService.updateContactTags(user.arizarContactId, ['miembro-inactivo']);
      await arizarService.removeContactTags(user.arizarContactId, ['miembro-activo', `plan-${plan?.slug}`]);

      // Custom fields
      await arizarService.syncContactCustomFields(user.arizarContactId, {
        planStatus: 'expired',
      });

      // Notification
      await arizarService.sendWhatsApp(user.arizarContactId,
        `⚠️ Tu membresía ${plan?.name} ha expirado\n\n` +
        `Renovála para seguir disfrutando de tus beneficios:\n` +
        `https://luxurygarage.arizar-ia.cloud/client/membership\n\n` +
        `¿Preguntas? Respondé este mensaje.`
      );

      // Note
      await arizarService.addContactNote(user.arizarContactId,
        `❌ Membresía expirada: ${plan?.name}\n📅 ${new Date().toLocaleString('es-PY', { timeZone: 'America/Asuncion' })}`
      );

      // Move pipeline → Stage: ❌ No Convirtió
      await arizarService.moveToNoConvirtio(user.arizarContactId);

      // Trigger recovery workflow
      await arizarService.triggerRecoveryWorkflow(user.arizarContactId);

      await this._logSync('membership_expired', user.id, user.arizarContactId, { plan: plan?.name });
    } catch (err) {
      console.error(`❌ SYNC ERROR (membership_expired):`, err.message);
    }
  }

  /**
   * Sync appointment booking — note, notification
   */
  async syncAppointmentBooked(user, appointment) {
    if (!user.arizarContactId) return;

    try {
      await arizarService.notifyAppointmentBooked(user, appointment);

      const serviceName = appointment.service?.name || 'Servicio';
      const vehicleInfo = appointment.vehicle ? `${appointment.vehicle.brand} ${appointment.vehicle.model}` : '';
      await arizarService.addContactNote(user.arizarContactId,
        `📅 Turno agendado: ${serviceName}\n🚗 ${vehicleInfo}\n⏰ ${new Date(appointment.startTime).toLocaleString('es-PY', { timeZone: 'America/Asuncion' })}`
      );

      // Move pipeline → Stage: 📅 Visita Agendada
      await arizarService.moveToVisita(user.arizarContactId);

      await this._logSync('appointment_booked', user.id, user.arizarContactId, { appointmentId: appointment.id });
    } catch (err) {
      console.error(`❌ SYNC ERROR (appointment_booked):`, err.message);
    }
  }

  /**
   * Sync appointment cancellation
   */
  async syncAppointmentCancelled(user, appointment) {
    if (!user.arizarContactId) return;

    try {
      await arizarService.notifyAppointmentCancelled(user, appointment);
      await arizarService.addContactNote(user.arizarContactId,
        `❌ Turno cancelado: ${appointment.service?.name || 'Servicio'}\n📅 ${new Date(appointment.startTime).toLocaleString('es-PY', { timeZone: 'America/Asuncion' })}`
      );
      await this._logSync('appointment_cancelled', user.id, user.arizarContactId, { appointmentId: appointment.id });
    } catch (err) {
      console.error(`❌ SYNC ERROR (appointment_cancelled):`, err.message);
    }
  }

  /**
   * Sync service completion — custom fields, tags, note, review workflow
   */
  async syncServiceCompleted(user, appointment, serviceRecord) {
    if (!user.arizarContactId) return;

    try {
      // Notification
      await arizarService.notifyServiceCompleted(user, appointment, serviceRecord);

      // Update custom fields: servicesUsed + lastVisit
      const serviceCount = await this.prisma.serviceRecord.count({ where: { appointment: { userId: user.id }, completedAt: { not: null } } });
      await arizarService.syncContactCustomFields(user.arizarContactId, {
        servicesUsed: serviceCount,
        lastVisit: new Date().toISOString(),
      });

      // First wash tag
      if (serviceCount === 1) {
        await arizarService.updateContactTags(user.arizarContactId, ['primer-lavado-completado']);
      }

      // Frequent client tag (8+ in current month)
      const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0,0,0,0);
      const monthCount = await this.prisma.serviceRecord.count({
        where: { appointment: { userId: user.id }, completedAt: { gte: startOfMonth } }
      });
      if (monthCount >= 8) {
        await arizarService.updateContactTags(user.arizarContactId, ['cliente-frecuente']);
      }

      // Note with details
      const duration = serviceRecord?.durationMinutes ? `${serviceRecord.durationMinutes} min` : '';
      await arizarService.addContactNote(user.arizarContactId,
        `✅ Servicio completado: ${appointment.service?.name}\n🚗 ${appointment.vehicle?.brand} ${appointment.vehicle?.model}\n⏱️ ${duration}\n📝 ${serviceRecord?.notes || ''}${serviceRecord?.vehicleObservations ? '\n🔍 Observaciones: ' + serviceRecord.vehicleObservations : ''}\n📊 Total servicios: ${serviceCount}`
      );

      // Trigger post-service workflow (review request)
      await arizarService.triggerPostServiceWorkflow(user.arizarContactId);

      await this._logSync('service_completed', user.id, user.arizarContactId, { appointmentId: appointment.id, serviceCount });
    } catch (err) {
      console.error(`❌ SYNC ERROR (service_completed):`, err.message);
    }
  }

  /**
   * Sync reseña dejada por el cliente.
   * - Recalcula rating promedio y total de reseñas → custom fields
   * - Tag según el rating de ESTA reseña (`resena-5-estrellas`, etc.; `detractor` si <=2)
   * - Nota en el contacto con la calificación y el comentario
   * - Si rating <= 2: además marca para seguimiento (workflow de recuperación,
   *   tag y tarea) para que el equipo intervenga.
   *
   * Se debería llamar desde routes/reviews.js en el POST / (creación de reseña).
   */
  async syncReview(user, review) {
    if (!user.arizarContactId) return;

    try {
      const rating = review?.rating || 0;

      // Métricas agregadas de reputación del cliente (todas sus reseñas)
      const agg = await this.prisma.review.aggregate({
        where: { userId: user.id },
        _avg: { rating: true },
        _count: { _all: true },
      });
      const ratingPromedio = agg._avg?.rating ? Math.round(agg._avg.rating * 10) / 10 : rating;
      const totalReviews = agg._count?._all || 1;

      // Custom fields de reputación.
      // NOTA AL ORQUESTADOR: el mapeo de syncContactCustomFields() en arizarService.js
      // (que NO edito) debe incluir estas dos entradas para que los valores lleguen al CRM:
      //   ratingPromedio: 'luxury_rating_promedio',
      //   totalReviews:   'luxury_total_reviews',
      // Sin esas líneas el método los descarta silenciosamente (la nota y los tags sí se envían).
      await arizarService.syncContactCustomFields(user.arizarContactId, {
        ratingPromedio,
        totalReviews,
      });

      // Tag según la calificación de esta reseña
      const ratingTag = rating <= 2 ? 'detractor' : `resena-${rating}-estrellas`;
      await arizarService.updateContactTags(user.arizarContactId, [ratingTag]);

      // Nota con la calificación y el comentario
      const stars = '⭐'.repeat(Math.max(0, Math.min(5, rating)));
      await arizarService.addContactNote(user.arizarContactId,
        `📝 Reseña recibida: ${stars} (${rating}/5)\n` +
        `💬 ${review?.comment || '(sin comentario)'}\n` +
        `📅 ${new Date().toLocaleString('es-PY', { timeZone: 'America/Asuncion' })}`
      );

      // Detractor → seguimiento activo
      if (rating <= 2) {
        await arizarService.removeContactTags(user.arizarContactId, [`resena-5-estrellas`, `resena-4-estrellas`, `resena-3-estrellas`]);
        await arizarService.triggerRecoveryWorkflow(user.arizarContactId);
        await arizarService.createTask(user.arizarContactId, {
          title: `⚠️ Reseña negativa (${rating}/5) de ${user.firstName} ${user.lastName}`,
          body: `El cliente dejó una reseña de ${rating}/5. Contactar para entender y resolver.\nComentario: ${review?.comment || '(sin comentario)'}`,
        });
      }

      await this._logSync('review', user.id, user.arizarContactId, { rating, totalReviews, ratingPromedio });
      console.log(`✅ SYNC: Reseña ${rating}/5 sincronizada para ${user.email}`);
    } catch (err) {
      console.error(`❌ SYNC ERROR (review):`, err.message);
    }
  }

  /**
   * Sync de un pago individual (recarga de billetera o pago de servicio).
   * Registra el pago como NOTA en el contacto y actualiza el saldo de billetera
   * (`luxury_wallet_balance`) recalculándolo desde los créditos vigentes.
   *
   * IMPORTANTE: NO usar para pagos que ya gatillan otra sincronización
   * (ej. activación de membresía → syncMembershipActivated). Esos ya quedan
   * cubiertos por su propio flujo.
   *
   * Se debería llamar desde routes/payments.js (charge-topup / pago de servicio)
   * y/o routes/credits.js tras acreditar/debitar un Credit.
   */
  async syncPayment(user, payment) {
    if (!user.arizarContactId) return;

    try {
      const amount = payment?.amountGs || 0;
      const method = payment?.paymentMethod || 'Bancard';
      const concepto = payment?.description || 'Pago';

      // Recalcular saldo de billetera vigente (créditos no expirados)
      const wallet = await this.prisma.credit.aggregate({
        where: {
          userId: user.id,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        _sum: { amount: true },
      });
      const walletBalance = wallet._sum?.amount || 0;

      await arizarService.syncContactCustomFields(user.arizarContactId, {
        walletBalance,
      });

      // Nota con el detalle del pago
      await arizarService.addContactNote(user.arizarContactId,
        `💳 Pago registrado: ₲${amount.toLocaleString()}\n` +
        `🧾 Concepto: ${concepto}\n` +
        `💠 Método: ${method}\n` +
        `👛 Saldo billetera: ₲${walletBalance.toLocaleString()}\n` +
        `📅 ${new Date().toLocaleString('es-PY', { timeZone: 'America/Asuncion' })}`
      );

      await this._logSync('payment', user.id, user.arizarContactId, { paymentId: payment?.id, amount, walletBalance });
    } catch (err) {
      console.error(`❌ SYNC ERROR (payment):`, err.message);
    }
  }

  /**
   * Sync wallet top-up — custom fields, notification
   */
  async syncWalletTopUp(user, amount) {
    if (!user.arizarContactId) return;

    try {
      await arizarService.notifyWalletTopUp(user, amount);

      // Get current wallet balance (credits table, minus consumed)
      const wallet = await this.prisma.credit.aggregate({
        where: {
          userId: user.id,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        _sum: { amount: true },
      });
      await arizarService.syncContactCustomFields(user.arizarContactId, {
        walletBalance: wallet._sum?.amount || 0,
      });

      await arizarService.addContactNote(user.arizarContactId,
        `💰 Carga de billetera: ₲${amount.toLocaleString()}\n📅 ${new Date().toLocaleString('es-PY', { timeZone: 'America/Asuncion' })}`
      );
      await this._logSync('wallet_topup', user.id, user.arizarContactId, { amount });
    } catch (err) {
      console.error(`❌ SYNC ERROR (wallet_topup):`, err.message);
    }
  }

  /**
   * Sync referral
   */
  async syncReferral(referrerUser, newUser) {
    try {
      if (referrerUser.arizarContactId) {
        await arizarService.notifyReferralRegistered(referrerUser, `${newUser.firstName} ${newUser.lastName}`);
        await arizarService.updateContactTags(referrerUser.arizarContactId, ['referidor-activo']);
        await arizarService.addContactNote(referrerUser.arizarContactId,
          `🎁 Referido registrado: ${newUser.firstName} ${newUser.lastName} (${newUser.email})`
        );
      }
      await this._logSync('referral', referrerUser.id, referrerUser.arizarContactId, { referredUserId: newUser.id });
    } catch (err) {
      console.error(`❌ SYNC ERROR (referral):`, err.message);
    }
  }

  /**
   * Sync membership renewal reminder — tag, workflow
   */
  async syncRenewalReminder(user, membership) {
    if (!user.arizarContactId) return;

    try {
      await arizarService.updateContactTags(user.arizarContactId, ['renovacion-pendiente']);
      await arizarService.triggerRenewalWorkflow(user.arizarContactId);
      await this._logSync('renewal_reminder', user.id, user.arizarContactId, { membershipId: membership.id });
    } catch (err) {
      console.error(`❌ SYNC ERROR (renewal_reminder):`, err.message);
    }
  }

  /**
   * Sync inactivity detection
   *
   * CRON: ya está conectado. jobs/membershipJobs.js lo invoca a diario 09:00
   * (America/Asuncion) recorriendo membresías ACTIVE: calcula días desde el
   * último servicio completado y llama syncInactivity(user, daysSince) cuando
   * daysSince >= 15. No requiere cron adicional. Si en el futuro se quiere
   * cubrir también a NO-miembros, el orquestador debería ampliar ese job
   * (jobs/ no se edita desde acá).
   */
  async syncInactivity(user, daysSinceLastVisit) {
    if (!user.arizarContactId) return;

    try {
      if (daysSinceLastVisit >= 30) {
        await arizarService.updateContactTags(user.arizarContactId, ['cliente-inactivo-30d']);
      } else if (daysSinceLastVisit >= 15) {
        await arizarService.updateContactTags(user.arizarContactId, ['cliente-inactivo-15d']);
        await arizarService.triggerRecoveryWorkflow(user.arizarContactId);
      }
      await this._logSync('inactivity_detected', user.id, user.arizarContactId, { daysSinceLastVisit });
    } catch (err) {
      console.error(`❌ SYNC ERROR (inactivity):`, err.message);
    }
  }

  /**
   * Bulk re-sync: sync all users to CRM with full custom fields
   */
  async bulkSyncAllUsers() {
    const users = await this.prisma.user.findMany({
      where: { role: 'CLIENT' },
      include: {
        memberships: { where: { status: 'ACTIVE' }, include: { plan: true }, take: 1 },
        vehicles: { take: 2, orderBy: { isPrimary: 'desc' } },
      }
    });

    let synced = 0, errors = 0;
    for (const user of users) {
      try {
        const plan = user.memberships[0]?.plan;
        const tags = ['luxury-garage'];
        if (plan) tags.push(`plan-${plan.slug}`, 'miembro-activo');
        else tags.push('miembro-inactivo');

        const result = await arizarService.upsertContact({
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          tags,
          source: 'bulk-sync',
        });

        const contactId = result?.contact?.id || result?.contactId;
        if (contactId) {
          if (!user.arizarContactId) {
            await this.prisma.user.update({ where: { id: user.id }, data: { arizarContactId: contactId } });
          }

          // Sync custom fields
          const serviceCount = await this.prisma.serviceRecord.count({ where: { appointment: { userId: user.id }, completedAt: { not: null } } });
          const lastRecord = await this.prisma.serviceRecord.findFirst({ where: { appointment: { userId: user.id }, completedAt: { not: null } }, orderBy: { completedAt: 'desc' } });

          await arizarService.syncContactCustomFields(contactId, {
            plan: plan?.slug || '',
            planStatus: plan ? 'active' : 'inactive',
            planExpiry: user.memberships[0]?.endDate?.toISOString?.() || '',
            vehicle1: user.vehicles[0] ? `${user.vehicles[0].brand} ${user.vehicles[0].model} ${user.vehicles[0].year} - ${user.vehicles[0].licensePlate}` : '',
            vehicle2: user.vehicles[1] ? `${user.vehicles[1].brand} ${user.vehicles[1].model} ${user.vehicles[1].year} - ${user.vehicles[1].licensePlate}` : '',
            servicesUsed: serviceCount,
            lastVisit: lastRecord?.completedAt?.toISOString?.() || '',
            userId: user.id,
          });
        }
        synced++;

        // Rate limit protection
        await new Promise(r => setTimeout(r, 250));
      } catch (err) {
        errors++;
        console.error(`❌ Bulk sync error for ${user.email}:`, err.message);
      }
    }

    return { total: users.length, synced, errors };
  }

  /**
   * Get sync stats
   */
  async getSyncStats() {
    const [totalUsers, syncedUsers, totalAppointments, logs] = await Promise.all([
      this.prisma.user.count({ where: { role: 'CLIENT' } }),
      this.prisma.user.count({ where: { role: 'CLIENT', arizarContactId: { not: null } } }),
      this.prisma.appointment.count(),
      this.prisma.auditLog.findMany({ where: { entity: 'arizar_sync' }, orderBy: { createdAt: 'desc' }, take: 20 }),
    ]);

    return {
      contacts: { total: totalUsers, synced: syncedUsers, percentage: totalUsers > 0 ? Math.round((syncedUsers / totalUsers) * 100) : 0 },
      appointments: totalAppointments,
      configured: arizarService.isConfigured(),
      recentLogs: logs,
    };
  }

  /**
   * Internal: log sync action
   */
  async _logSync(action, userId, contactId, extra = {}) {
    try {
      await this.prisma.auditLog.create({
        data: {
          entity: 'arizar_sync',
          action,
          entityId: contactId || 'unknown',
          userId,
          detailsJson: { contactId, ...extra },
        }
      });
    } catch (err) {
      // Silent fail for logging
    }
  }
}

module.exports = ArizarSync;
