/* ============================================================
   Clinic Queue Management System — Shared Data Layer (queue.js)
   Include this before admin.js and display.js
   Uses localStorage to sync between admin and display board tabs
   ============================================================ */

const QueueStore = (() => {
  const STORAGE_KEY = 'clinic_queue_v2';
  const LISTENERS   = [];

  const DEFAULT_DOCTORS = [
    { id: 'd1', name: 'Dr. Amara Osei',    dept: 'GP',         available: true,  room: 'Room 1', currentPatient: null },
    { id: 'd2', name: 'Dr. Priya Naidoo',  dept: 'Specialist', available: true,  room: 'Room 2', currentPatient: null },
    { id: 'd3', name: 'Dr. Leon du Plessis',dept:'Emergency',  available: true,  room: 'Room 3', currentPatient: null },
    { id: 'd4', name: 'Dr. Siphiwe Khumalo',dept:'Lab',        available: true,  room: 'Room 4', currentPatient: null },
  ];

  function getState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch(e) {}
    return {
      queue: [],
      completed: [],
      doctors: DEFAULT_DOCTORS,
      counter: 1,
      totalToday: 0,
      waitTimes: [],
      lastUpdated: Date.now(),
    };
  }

  function setState(updater) {
    const state = getState();
    const next  = typeof updater === 'function' ? updater(state) : { ...state, ...updater };
    next.lastUpdated = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    LISTENERS.forEach(fn => fn(next));
    return next;
  }

  function subscribe(fn) {
    LISTENERS.push(fn);
    // Also watch cross-tab updates
    window.addEventListener('storage', e => {
      if (e.key === STORAGE_KEY) fn(getState());
    });
    return () => {
      const i = LISTENERS.indexOf(fn);
      if (i > -1) LISTENERS.splice(i, 1);
    };
  }

  // ---- Actions ----

  function addPatient(name, dept, priority) {
    return setState(s => {
      const patient = {
        id: Date.now() + Math.random(),
        num: s.counter,
        name, dept, priority,
        addedAt: Date.now(),
        status: 'waiting', // waiting | serving | done | skipped
        doctorId: null,
      };
      const queue = [...s.queue, patient]
        .sort((a,b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.addedAt - b.addedAt);
      return { ...s, queue, counter: s.counter + 1, totalToday: s.totalToday + 1 };
    });
  }

  function assignToDoctor(doctorId, patientId) {
    return setState(s => {
      const patient = s.queue.find(p => p.id === patientId);
      if (!patient) return s;

      const queue = s.queue.filter(p => p.id !== patientId);
      const doctors = s.doctors.map(d => {
        if (d.id !== doctorId) return d;
        return { ...d, available: false, currentPatient: { ...patient, serveStart: Date.now() } };
      });
      return { ...s, queue, doctors };
    });
  }

  function callNextForDoctor(doctorId) {
    return setState(s => {
      const doc = s.doctors.find(d => d.id === doctorId);
      if (!doc || !doc.available) return s;
      // pick highest-priority matching dept or any
      const match = s.queue.find(p => p.dept === doc.dept) || s.queue[0];
      if (!match) return s;
      const queue   = s.queue.filter(p => p.id !== match.id);
      const doctors = s.doctors.map(d => d.id === doctorId
        ? { ...d, available: false, currentPatient: { ...match, serveStart: Date.now() } }
        : d);
      return { ...s, queue, doctors };
    });
  }

  function completeDoctor(doctorId) {
    return setState(s => {
      const doc = s.doctors.find(d => d.id === doctorId);
      if (!doc || !doc.currentPatient) return s;
      const dur = Math.round((Date.now() - doc.currentPatient.serveStart) / 60000);
      const completed = [
        { ...doc.currentPatient, duration: dur, completedAt: new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}), doctorName: doc.name },
        ...s.completed,
      ].slice(0, 50);
      const waitTimes = [...s.waitTimes, dur];
      const doctors = s.doctors.map(d => d.id === doctorId
        ? { ...d, available: true, currentPatient: null }
        : d);
      return { ...s, doctors, completed, waitTimes };
    });
  }

  function skipDoctor(doctorId) {
    return setState(s => {
      const doctors = s.doctors.map(d => d.id === doctorId
        ? { ...d, available: true, currentPatient: null }
        : d);
      return { ...s, doctors };
    });
  }

  function removeFromQueue(patientId) {
    return setState(s => ({
      ...s,
      queue: s.queue.filter(p => p.id !== patientId),
      totalToday: Math.max(0, s.totalToday - 1),
    }));
  }

  function addDoctor(name, dept, room) {
    return setState(s => ({
      ...s,
      doctors: [...s.doctors, {
        id: 'doc_' + Date.now(),
        name, dept, room,
        available: true,
        currentPatient: null,
      }],
    }));
  }

  function removeDoctor(doctorId) {
    return setState(s => ({
      ...s,
      doctors: s.doctors.filter(d => d.id !== doctorId),
    }));
  }

  function toggleDoctorAvailability(doctorId) {
    return setState(s => ({
      ...s,
      doctors: s.doctors.map(d => d.id === doctorId
        ? { ...d, available: d.currentPatient ? d.available : !d.available }
        : d),
    }));
  }

  function resetDay() {
    localStorage.removeItem(STORAGE_KEY);
    const fresh = getState();
    setState(() => fresh);
  }

  const PRIORITY_ORDER = { urgent: 0, high: 1, normal: 2 };

  const DEPT_LABELS = {
    GP: 'General Practice',
    Specialist: 'Specialist',
    Emergency: 'Emergency',
    Lab: 'Laboratory',
  };

  return {
    getState, setState, subscribe,
    addPatient, assignToDoctor, callNextForDoctor,
    completeDoctor, skipDoctor, removeFromQueue,
    addDoctor, removeDoctor, toggleDoctorAvailability,
    resetDay,
    PRIORITY_ORDER, DEPT_LABELS,
  };
})();
