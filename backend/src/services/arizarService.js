const axios = require('axios');

/**
 * ARIZAR IA Integration Service
 * Full GoHighLevel CRM integration for Luxury Garage
 * 
 * Supports: Contacts, Calendar, Conversations (SMS/Email/WhatsApp),
 * Opportunities, Notes, Tags, Workflows, Tasks
 */
class ArizarService {
  constructor() {
    this.baseURL = process.env.ARIZAR_BASE_URL || 'https://services.leadconnectorhq.com';
    this.token = process.env.ARIZAR_API_TOKEN;
    this.locationId = process.env.ARIZAR_LOCATION_ID;
    this.calendarId = process.env.ARIZAR_CALENDAR_ID;
    this.pipelineId = process.env.ARIZAR_PIPELINE_ID;
    this.firstStageId = process.env.ARIZAR_FIRST_STAGE_ID;

    // Pipeline stages — Luxury Garage
    this.stages = {
      consultaRecibida: process.env.ARIZAR_FIRST_STAGE_ID,
      enSeguimiento: process.env.ARIZAR_STAGE_SEGUIMIENTO,
      propuestaEnviada: process.env.ARIZAR_STAGE_PROPUESTA,
      visitaAgendada: process.env.ARIZAR_STAGE_VISITA,
      miembroActivo: process.env.ARIZAR_STAGE_MIEMBRO,
      noConvirtio: process.env.ARIZAR_STAGE_PERDIDO,
    };

    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 15000,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Version': process.env.ARIZAR_API_VERSION || '2021-07-28',
        'Content-Type': 'application/json',
      },
    });

    // Request/response logging in dev
    if (process.env.NODE_ENV !== 'production') {
      this.client.interceptors.response.use(
        res => res,
        err => {
          console.error(`❌ ARIZAR API Error: ${err.config?.method?.toUpperCase()} ${err.config?.url}`, err.response?.data || err.message);
          throw err;
        }
      );
    }
  }

  /** Check if the service is properly configured */
  isConfigured() {
    return this.token && this.locationId && this.locationId !== 'pending_configuration';
  }

  /** Safe wrapper — won't crash if ARIZAR not configured */
  async _safe(fn, fallback = null) {
    if (!this.isConfigured()) {
      console.warn('⚠️ ARIZAR IA no configurado, operación omitida');
      return fallback;
    }
    try { return await fn(); }
    catch (err) {
      console.error(`❌ ARIZAR IA error:`, err.response?.data?.message || err.message);
      return fallback;
    }
  }

  // ═══════════════════════════════════════════════
  //  CONTACTS — Gestión completa de contactos
  // ═══════════════════════════════════════════════

  /** Crear o actualizar contacto en ARIZAR IA */
  async upsertContact(data) {
    return this._safe(async () => {
      const payload = {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        locationId: this.locationId,
        tags: data.tags || ['luxury-garage'],
        source: data.source || 'portal-web',
        customFields: data.customFields || [],
      };
      const response = await this.client.post('/contacts/upsert', payload);
      return response.data;
    });
  }

  /** Obtener un contacto por ID */
  async getContact(contactId) {
    return this._safe(async () => {
      const response = await this.client.get(`/contacts/${contactId}`);
      return response.data;
    });
  }

  /** Buscar contacto por email */
  async findContactByEmail(email) {
    return this._safe(async () => {
      const response = await this.client.get('/contacts/', {
        params: { locationId: this.locationId, query: email, limit: 1 }
      });
      return response.data?.contacts?.[0] || null;
    });
  }

  /** Actualizar tags de un contacto */
  async updateContactTags(contactId, tags) {
    return this._safe(async () => {
      const response = await this.client.post(`/contacts/${contactId}/tags`, { tags });
      return response.data;
    });
  }

  /** Eliminar tags de un contacto */
  async removeContactTags(contactId, tags) {
    return this._safe(async () => {
      const response = await this.client.delete(`/contacts/${contactId}/tags`, { data: { tags } });
      return response.data;
    });
  }

  /** Añadir nota a un contacto */
  async addContactNote(contactId, body) {
    return this._safe(async () => {
      const response = await this.client.post(`/contacts/${contactId}/notes`, {
        body, userId: this.locationId
      });
      return response.data;
    });
  }

  /** Actualizar campos personalizados */
  async updateContactCustomFields(contactId, customFields) {
    return this._safe(async () => {
      const response = await this.client.put(`/contacts/${contactId}`, { customFields });
      return response.data;
    });
  }

  /** Agregar contacto a un workflow */
  async addToWorkflow(contactId, workflowId) {
    return this._safe(async () => {
      const response = await this.client.post(`/contacts/${contactId}/workflow/${workflowId}`);
      return response.data;
    });
  }

  /** Eliminar contacto de un workflow */
  async removeFromWorkflow(contactId, workflowId) {
    return this._safe(async () => {
      const response = await this.client.delete(`/contacts/${contactId}/workflow/${workflowId}`);
      return response.data;
    });
  }

  // ═══════════════════════════════════════════════
  //  CALENDAR — Agenda y Slots
  // ═══════════════════════════════════════════════

  /** Obtener slots disponibles del calendario */
  async getFreeSlots(startDate, endDate) {
    return this._safe(async () => {
      const response = await this.client.get(`/calendars/${this.calendarId}/free-slots`, {
        params: { startDate, endDate, timezone: 'America/Asuncion' }
      });
      return response.data;
    }, { slots: [] });
  }

  /** Crear cita en el calendario */
  async createAppointment(data) {
    return this._safe(async () => {
      const payload = {
        calendarId: this.calendarId,
        locationId: this.locationId,
        contactId: data.contactId,
        startTime: data.startTime,
        endTime: data.endTime,
        title: data.title,
        notes: data.notes || '',
        appointmentStatus: 'confirmed',
      };
      console.log(`[ARIZAR CAL] Creating appointment: calendarId=${this.calendarId}, contactId=${data.contactId}, start=${data.startTime}`);
      // Correct GHL API v2 endpoint for calendar appointments
      const response = await this.client.post('/calendars/events/appointments', payload);
      console.log(`[ARIZAR CAL] Created OK: eventId=${response.data?.id || response.data?.event?.id}`);
      return response.data;
    });
  }

  /** Actualizar cita */
  async updateAppointment(eventId, data) {
    return this._safe(async () => {
      const response = await this.client.put(`/calendars/events/appointments/${eventId}`, data);
      return response.data;
    });
  }

  /** Eliminar cita */
  async deleteAppointment(eventId) {
    return this._safe(async () => {
      const response = await this.client.delete(`/calendars/events/appointments/${eventId}`);
      return response.data;
    });
  }

  // ═══════════════════════════════════════════════
  //  CONVERSATIONS — SMS, WhatsApp, Email
  // ═══════════════════════════════════════════════

  /** Enviar SMS */
  async sendSMS(contactId, message) {
    return this._safe(async () => {
      const payload = { type: 'SMS', contactId, message };
      const response = await this.client.post('/conversations/messages', payload);
      console.log(`📱 SMS enviado a contacto ${contactId}`);
      return response.data;
    });
  }

  /** Enviar Email */
  async sendEmail(contactId, subject, html) {
    return this._safe(async () => {
      const payload = {
        type: 'Email', contactId, subject, html,
        emailFrom: process.env.ARIZAR_EMAIL_FROM,
      };
      const response = await this.client.post('/conversations/messages', payload);
      console.log(`📧 Email enviado a contacto ${contactId}: ${subject}`);
      return response.data;
    });
  }

  /** Enviar WhatsApp */
  async sendWhatsApp(contactId, message) {
    return this._safe(async () => {
      const payload = { type: 'WhatsApp', contactId, message };
      const response = await this.client.post('/conversations/messages', payload);
      console.log(`💬 WhatsApp enviado a contacto ${contactId}`);
      return response.data;
    });
  }

  // ═══════════════════════════════════════════════
  //  OPPORTUNITIES — Pipeline de Membresías
  // ═══════════════════════════════════════════════

  /** Crear oportunidad (lead de membresía) */
  async createOpportunity(contactId, data) {
    return this._safe(async () => {
      const payload = {
        pipelineId: this.pipelineId,
        locationId: this.locationId,
        name: data.name || 'Membresía Luxury Garage',
        pipelineStageId: data.stageId || this.firstStageId,
        status: 'open',
        contactId,
        monetaryValue: data.value || 0,
        source: 'luxury-garage-portal',
      };
      const response = await this.client.post('/opportunities/', payload);
      return response.data;
    });
  }

  /** Mover oportunidad a otra etapa */
  async updateOpportunityStage(opportunityId, stageId) {
    return this._safe(async () => {
      const response = await this.client.put(`/opportunities/${opportunityId}`, {
        pipelineStageId: stageId,
      });
      return response.data;
    });
  }

  /** Cerrar oportunidad como ganada */
  async wonOpportunity(opportunityId) {
    return this._safe(async () => {
      const response = await this.client.put(`/opportunities/${opportunityId}`, { status: 'won' });
      return response.data;
    });
  }

  /** Cerrar oportunidad como perdida */
  async lostOpportunity(opportunityId) {
    return this._safe(async () => {
      const response = await this.client.put(`/opportunities/${opportunityId}`, { status: 'lost' });
      return response.data;
    });
  }

  // ═══════════════════════════════════════════════
  //  TASKS — Tareas asignadas
  // ═══════════════════════════════════════════════

  /** Crear tarea para seguimiento */
  async createTask(contactId, data) {
    return this._safe(async () => {
      const payload = {
        contactId,
        title: data.title,
        body: data.body || '',
        dueDate: data.dueDate || new Date(Date.now() + 86400000).toISOString(),
        completed: false,
      };
      const response = await this.client.post(`/contacts/${contactId}/tasks`, payload);
      return response.data;
    });
  }

  // ═══════════════════════════════════════════════
  //  BUSINESS LOGIC — Acciones integradas
  // ═══════════════════════════════════════════════

  /**
   * Sincronizar usuario con ARIZAR IA al registrarse
   * - Crea/actualiza contacto
   * - Agrega tags según rol
   * - Retorna el contactId de ARIZAR
   */
  async syncNewUser(user, plan = null) {
    const contact = await this.upsertContact({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      tags: [
        'luxury-garage',
        `role-${user.role.toLowerCase()}`,
        ...(plan ? [`plan-${plan.slug}`] : []),
      ],
      source: 'registro-portal',
    });

    const contactId = contact?.contact?.id || contact?.contactId || null;

    if (contactId) {
      // Nota de bienvenida
      await this.addContactNote(contactId,
        `🚗 Nuevo registro en Luxury Garage\n` +
        `📧 Email: ${user.email}\n` +
        `📱 Tel: ${user.phone || 'N/A'}\n` +
        `👤 Rol: ${user.role}\n` +
        `${plan ? `📋 Plan: ${plan.name} (₲${plan.priceGs?.toLocaleString()})` : ''}` +
        `\n📅 Fecha: ${new Date().toLocaleString('es-PY', { timeZone: 'America/Asuncion' })}`
      );
    }

    return contactId;
  }

  /**
   * Notificar servicio completado
   * - WhatsApp al cliente con resumen
   * - Actualiza tags y notas
   */
  async notifyServiceCompleted(user, appointment, serviceRecord) {
    if (!user.arizarContactId) return;

    const serviceName = appointment.service?.name || 'Servicio';
    const vehicleInfo = appointment.vehicle ? `${appointment.vehicle.brand} ${appointment.vehicle.model} (${appointment.vehicle.licensePlate})` : '';
    const duration = serviceRecord?.durationMinutes || '?';

    // Link de Google Reviews si está configurado
    const reviewLink = process.env.ARIZAR_GOOGLE_REVIEW_LINK;
    const reviewSection = (reviewLink && reviewLink !== 'pending_configuration')
      ? `\n\n⭐ ¿Quedaste satisfecho? Dejanos tu reseña en Google (¡nos ayudás muchísimo!):\n${reviewLink}`
      : `\n\nCalificanos en: https://luxurygarage.arizar-ia.cloud/client/reviews`;

    // WhatsApp al cliente
    await this.sendWhatsApp(user.arizarContactId,
      `✅ ¡Tu servicio en Luxury Garage está listo!\n\n` +
      `🚿 ${serviceName}\n` +
      `🚗 ${vehicleInfo}\n` +
      `⏱️ Duración: ${duration} min\n\n` +
      `¡Gracias por confiar en nosotros! 💎` +
      reviewSection
    );

    // Nota en el contacto
    await this.addContactNote(user.arizarContactId,
      `✅ Servicio completado: ${serviceName}\n` +
      `🚗 Vehículo: ${vehicleInfo}\n` +
      `⏱️ Duración real: ${duration} min\n` +
      `${serviceRecord?.notes ? `📝 Notas: ${serviceRecord.notes}` : ''}` +
      `${serviceRecord?.vehicleObservations ? `\n⚠️ Observaciones: ${serviceRecord.vehicleObservations}` : ''}`
    );

    // Tag de último servicio
    await this.updateContactTags(user.arizarContactId, ['servicio-reciente', `ultimo-${new Date().toISOString().split('T')[0]}`]);
  }

  /**
   * Notificar membresía activada
   */
  async notifyMembershipActivated(user, plan) {
    if (!user.arizarContactId) return;

    await this.sendWhatsApp(user.arizarContactId,
      `🎉 ¡Tu membresía ${plan.name} ha sido activada!\n\n` +
      `📋 Plan: ${plan.name}\n` +
      `💰 Precio: ₲${plan.priceGs?.toLocaleString()}/mes\n` +
      `✨ Beneficios:\n${plan.features?.slice(0, 5).map(f => `  • ${f}`).join('\n')}\n\n` +
      `Agendá tu primer turno: https://luxurygarage.arizar-ia.cloud/client/book\n\n` +
      `¡Bienvenido a la experiencia premium! 🚗💎`
    );

    await this.updateContactTags(user.arizarContactId, ['miembro-activo', `plan-${plan.slug}`]);
    await this.removeContactTags(user.arizarContactId, ['lead', 'prospecto', 'miembro-inactivo']);

    await this.addContactNote(user.arizarContactId,
      `👑 Membresía activada: ${plan.name}\n` +
      `💰 ₲${plan.priceGs?.toLocaleString()}/mes\n` +
      `📅 ${new Date().toLocaleString('es-PY', { timeZone: 'America/Asuncion' })}`
    );
  }

  /**
   * Notificar turno agendado
   */
  async notifyAppointmentBooked(user, appointment) {
    if (!user.arizarContactId) return;

    const date = new Date(appointment.startTime);
    const dateStr = date.toLocaleDateString('es-PY', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Asuncion' });
    const timeStr = date.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Asuncion' });

    await this.sendWhatsApp(user.arizarContactId,
      `📅 ¡Turno confirmado en Luxury Garage!\n\n` +
      `🚿 ${appointment.service?.name}\n` +
      `🚗 ${appointment.vehicle?.brand} ${appointment.vehicle?.model}\n` +
      `📆 ${dateStr}\n` +
      `⏰ ${timeStr}\n\n` +
      `📍 Tu turno está reservado. Si necesitás cancelar, hacelo desde tu portal.\n` +
      `¡Te esperamos! 🏎️`
    );
  }

  /**
   * Notificar turno cancelado
   */
  async notifyAppointmentCancelled(user, appointment) {
    if (!user.arizarContactId) return;

    await this.sendWhatsApp(user.arizarContactId,
      `❌ Tu turno ha sido cancelado\n\n` +
      `🚿 ${appointment.service?.name}\n` +
      `📅 ${new Date(appointment.startTime).toLocaleDateString('es-PY', { timeZone: 'America/Asuncion' })}\n\n` +
      `Podés reagendar en: https://luxurygarage.arizar-ia.cloud/client/book`
    );
  }

  /**
   * Enviar recordatorio de membresía por vencer
   */
  async sendMembershipReminder(user, membership, daysLeft) {
    if (!user.arizarContactId) return;

    const emoji = daysLeft <= 1 ? '🚨' : daysLeft <= 3 ? '⚠️' : '🔔';

    await this.sendWhatsApp(user.arizarContactId,
      `${emoji} Tu membresía ${membership.plan?.name} vence en ${daysLeft} día${daysLeft > 1 ? 's' : ''}\n\n` +
      `📋 Plan: ${membership.plan?.name}\n` +
      `📅 Vence: ${new Date(membership.endDate).toLocaleDateString('es-PY', { timeZone: 'America/Asuncion' })}\n\n` +
      `Renová desde tu portal para no perder tus beneficios:\n` +
      `https://luxurygarage.arizar-ia.cloud/client/membership`
    );
  }

  /**
   * Enviar recordatorio de turno
   */
  async sendAppointmentReminder(user, appointment) {
    if (!user.arizarContactId) return;

    const date = new Date(appointment.startTime);
    await this.sendWhatsApp(user.arizarContactId,
      `⏰ Recordatorio: Tenés un turno mañana\n\n` +
      `🚿 ${appointment.service?.name}\n` +
      `🚗 ${appointment.vehicle?.brand} ${appointment.vehicle?.model}\n` +
      `📆 ${date.toLocaleDateString('es-PY', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Asuncion' })}\n` +
      `⏰ ${date.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Asuncion' })}\n\n` +
      `¡Te esperamos en Luxury Garage! 🚗✨`
    );
  }

  /**
   * Notificación de bienvenida a referido
   */
  async notifyReferralRegistered(referrerUser, newUserName) {
    if (!referrerUser.arizarContactId) return;

    await this.sendWhatsApp(referrerUser.arizarContactId,
      `🎉 ¡Tu referido ${newUserName} se registró!\n\n` +
      `Se ha sumado a tu red de referidos en Luxury Garage.\n` +
      `Cuando active su membresía, recibirás tu lavado gratis 🎁\n\n` +
      `Seguí invitando: https://luxurygarage.arizar-ia.cloud/client/referrals`
    );
  }

  /**
   * Reporte de cobro/crédito
   */
  async notifyWalletTopUp(user, amountGs) {
    if (!user.arizarContactId) return;

    await this.sendWhatsApp(user.arizarContactId,
      `💰 ¡Carga exitosa en tu billetera!\n\n` +
      `Monto: ₲${amountGs.toLocaleString()}\n` +
      `Usalo en el showroom y servicios extras de Luxury Garage 🏎️`
    );
  }

  // ═══════════════════════════════════
  // INVOICES (Facturas via ARIZAR IA)
  // ═══════════════════════════════

  async createInvoice(data) {
    return this._safe(async () => {
      const payload = {
        locationId: this.locationId, contactId: data.contactId,
        name: data.name,
        items: (data.items || []).map(item => ({ name: item.name, amount: item.amount, quantity: item.quantity || 1 })),
        currency: data.currency || 'PYG',
      };
      const response = await this.client.post('/invoices/', payload);
      return response.data;
    });
  }

  async sendInvoice(invoiceId) {
    return this._safe(async () => {
      const response = await this.client.post(`/invoices/${invoiceId}/send`);
      return response.data;
    });
  }

  async recordPayment(invoiceId, data) {
    return this._safe(async () => {
      const response = await this.client.post(`/invoices/${invoiceId}/record-payment`, {
        amount: data.amount, mode: data.mode || 'custom', notes: data.notes || '',
      });
      return response.data;
    });
  }

  async getContactInvoices(contactId) {
    return this._safe(async () => {
      const response = await this.client.get('/invoices/', {
        params: { altId: contactId, altType: 'contact', locationId: this.locationId, limit: 50 }
      });
      return response.data?.invoices || response.data?.data || [];
    }, []);
  }

  // ═══════════════════════════════════
  // REVIEWS (Reseñas)
  // ═══════════════════════════════

  async getReviews() {
    return this._safe(async () => {
      const response = await this.client.get(`/social-media-posting/reviews/${this.locationId}`);
      return response.data?.reviews || response.data?.data || [];
    }, []);
  }

  async replyReview(reviewId, message) {
    return this._safe(async () => {
      const response = await this.client.put(`/social-media-posting/reviews/${reviewId}`, {
        reply: message, locationId: this.locationId,
      });
      return response.data;
    });
  }

  // ═══════════════════════════════════
  // CUSTOM FIELDS sync
  // ═══════════════════════════════

  async syncContactCustomFields(contactId, data) {
    return this._safe(async () => {
      let fieldsRes;
      try { fieldsRes = await this.client.get(`/locations/${this.locationId}/customFields`); } catch (e) { return; }
      const fields = fieldsRes.data?.customFields || fieldsRes.data?.data || [];
      const fieldMap = {};
      for (const f of fields) { fieldMap[f.name] = f.id; }
      const customFieldValues = [];
      const mapping = {
        plan: 'luxury_plan', planStatus: 'luxury_plan_status', planExpiry: 'luxury_plan_expiry',
        vehicle1: 'luxury_vehicle_1', vehicle2: 'luxury_vehicle_2',
        servicesUsed: 'luxury_services_used', lastVisit: 'luxury_last_visit',
        walletBalance: 'luxury_wallet_balance', referralCode: 'luxury_referral_code', userId: 'luxury_user_id',
      };
      for (const [key, fieldName] of Object.entries(mapping)) {
        if (data[key] !== undefined && fieldMap[fieldName]) {
          customFieldValues.push({ id: fieldMap[fieldName], value: data[key] });
        }
      }
      if (customFieldValues.length > 0) {
        await this.client.put(`/contacts/${contactId}`, { customFields: customFieldValues });
      }
    });
  }

  // ═══════════════════════════════════
  // WORKFLOW TRIGGERS
  // ═══════════════════════════════

  async triggerPostServiceWorkflow(contactId) {
    const wfId = process.env.ARIZAR_WORKFLOW_POST_SERVICIO;
    if (wfId && wfId !== 'pending_configuration') return this.addToWorkflow(contactId, wfId);
  }

  async triggerWelcomeWorkflow(contactId) {
    const wfId = process.env.ARIZAR_WORKFLOW_BIENVENIDA;
    if (wfId && wfId !== 'pending_configuration') return this.addToWorkflow(contactId, wfId);
  }

  async triggerRecoveryWorkflow(contactId) {
    const wfId = process.env.ARIZAR_WORKFLOW_RECUPERACION;
    if (wfId && wfId !== 'pending_configuration') return this.addToWorkflow(contactId, wfId);
  }

  async triggerRenewalWorkflow(contactId) {
    const wfId = process.env.ARIZAR_WORKFLOW_RENOVACION;
    if (wfId && wfId !== 'pending_configuration') return this.addToWorkflow(contactId, wfId);
  }

  // ═══════════════════════════════════
  // SOCIAL PLANNER
  // ═══════════════════════════════

  async getSocialAccounts() {
    return this._safe(async () => {
      const response = await this.client.get(`/social-media-posting/oauth/${this.locationId}/accounts`);
      return response.data?.accounts || response.data?.data || [];
    }, []);
  }

  async createSocialPost(data) {
    return this._safe(async () => {
      const response = await this.client.post('/social-media-posting/', {
        locationId: this.locationId, type: 'post', accountIds: data.accountIds,
        content: data.content, mediaUrls: data.mediaUrls || [],
        scheduleDate: data.scheduleDate || new Date().toISOString(),
      });
      return response.data;
    });
  }

  async getSocialPosts() {
    return this._safe(async () => {
      const response = await this.client.get(`/social-media-posting/post/${this.locationId}`);
      return response.data?.posts || response.data?.data || [];
    }, []);
  }

  // ═══════════════════════════════════
  // PIPELINE STAGE MOVEMENT
  // ═══════════════════════════════════

  /** Move opportunity to a specific stage */
  async moveToStage(contactId, stageId) {
    return this._safe(async () => {
      // Find opportunity for this contact. Retry once: GHL search index can lag
      // a few seconds after POST /opportunities/
      let opp = null;
      for (let attempt = 0; attempt < 3 && !opp; attempt++) {
        if (attempt > 0) await new Promise(r => setTimeout(r, 1500));
        const searchRes = await this.client.get('/opportunities/search', {
          params: { location_id: this.locationId, contact_id: contactId, pipeline_id: this.pipelineId }
        });
        opp = searchRes.data?.opportunities?.[0];
      }
      if (opp) {
        await this.client.put(`/opportunities/${opp.id}`, {
          pipelineStageId: stageId, status: 'open',
        });
      }
    });
  }

  async moveToSeguimiento(contactId) { return this.moveToStage(contactId, this.stages.enSeguimiento); }
  async moveToPropuesta(contactId) { return this.moveToStage(contactId, this.stages.propuestaEnviada); }
  async moveToVisita(contactId) { return this.moveToStage(contactId, this.stages.visitaAgendada); }
  async moveToMiembro(contactId) { return this.moveToStage(contactId, this.stages.miembroActivo); }
  async moveToNoConvirtio(contactId) {
    return this._safe(async () => {
      let opp = null;
      for (let attempt = 0; attempt < 3 && !opp; attempt++) {
        if (attempt > 0) await new Promise(r => setTimeout(r, 1500));
        const searchRes = await this.client.get('/opportunities/search', {
          params: { location_id: this.locationId, contact_id: contactId, pipeline_id: this.pipelineId }
        });
        opp = searchRes.data?.opportunities?.[0];
      }
      if (opp) {
        await this.client.put(`/opportunities/${opp.id}`, {
          pipelineStageId: this.stages.noConvirtio, status: 'lost',
        });
      }
    });
  }

  // ═══════════════════════════════════
  // CONVERSATIONS (Lectura)
  // ═══════════════════════════════

  /** Obtener lista de conversaciones activas del location */
  async getConversations(params = {}) {
    return this._safe(async () => {
      const response = await this.client.get('/conversations/search', {
        params: {
          locationId: this.locationId,
          limit:      params.limit || 25,
          ...(params.contactId && { contactId: params.contactId }),
          ...(params.query    && { query:     params.query }),
          ...(params.unread   && { unread:    true }),
        },
      });
      return response.data?.conversations || response.data?.data || [];
    }, []);
  }

  /** Obtener mensajes de una conversación */
  async getConversationMessages(conversationId, limit = 50) {
    return this._safe(async () => {
      const response = await this.client.get(`/conversations/${conversationId}/messages`, {
        params: { limit },
      });
      return response.data?.messages || response.data?.data || [];
    }, []);
  }
}

module.exports = new ArizarService();

