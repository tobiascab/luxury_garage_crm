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
   */
  async syncProfileUpdate(user) {
    if (!user.arizarContactId) return;

    try {
      await arizarService.upsertContact({
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
      });

      // Sync vehicles
      const vehicles = await this.prisma.vehicle.findMany({ where: { userId: user.id }, take: 2, orderBy: { isPrimary: 'desc' } });
      if (vehicles.length > 0) {
        await arizarService.syncContactCustomFields(user.arizarContactId, {
          vehicle1: vehicles[0] ? `${vehicles[0].brand} ${vehicles[0].model} ${vehicles[0].year} - ${vehicles[0].licensePlate}` : '',
          vehicle2: vehicles[1] ? `${vehicles[1].brand} ${vehicles[1].model} ${vehicles[1].year} - ${vehicles[1].licensePlate}` : '',
        });
      }

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
   * Sync wallet top-up — custom fields, notification
   */
  async syncWalletTopUp(user, amount) {
    if (!user.arizarContactId) return;

    try {
      await arizarService.notifyWalletTopUp(user, amount);

      // Get current wallet balance
      const wallet = await this.prisma.walletTransaction.aggregate({
        where: { userId: user.id },
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
          details: { contactId, ...extra },
        }
      });
    } catch (err) {
      // Silent fail for logging
    }
  }
}

module.exports = ArizarSync;
