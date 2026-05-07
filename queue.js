import { supabase } from "./supabase.js";


window.QueueStore = (() => {
  const STORAGE_KEY = "clinic_queue_v2";
  const LISTENERS = [];

 
  const CLINIC_ID = "00001";

  const DEFAULT_DOCTORS = [];

  const PRIORITY_ORDER = { urgent: 0, high: 1, normal: 2 };

  const DEPT_LABELS = {
    GP: "General Practice",
    Specialist: "Specialist",
    Emergency: "Emergency",
    Lab: "Laboratory",
  };

  function normalizeDept(value) {
    const raw = String(value || "GP").trim().toLowerCase();

    if (raw.includes("emergency")) return "Emergency";
    if (raw.includes("special")) return "Specialist";
    if (raw.includes("lab")) return "Lab";
    if (raw.includes("general") || raw === "gp") return "GP";

    return "GP";
  }

  function getState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (error) {
      console.error("Could not read queue state from localStorage:", error);
    }

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
    const next = typeof updater === "function" ? updater(state) : { ...state, ...updater };

    next.lastUpdated = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    LISTENERS.forEach(fn => fn(next));

    return next;
  }

  function subscribe(fn) {
    LISTENERS.push(fn);

    window.addEventListener("storage", e => {
      if (e.key === STORAGE_KEY) fn(getState());
    });

    return () => {
      const i = LISTENERS.indexOf(fn);
      if (i > -1) LISTENERS.splice(i, 1);
    };
  }

  async function addPatient(name, dept, priority) {
    const id = Date.now();
    const currentState = getState();

    const patient = {
      id,
      num: currentState.counter,
      name,
      dept: normalizeDept(dept),
      priority: priority || "normal",
      addedAt: Date.now(),
      status: "waiting",
      doctorId: null,
    };

    const { data, error } = await supabase
      .from("clinic_queue")
      .insert({
        id: patient.id,
        ClinicID: CLINIC_ID,
        patient_name: patient.name,
        status: "waiting",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to insert patient into clinic_queue:", error);
      alert("Patient was not added to Supabase: " + error.message);
      return null;
    }

    console.log("Inserted into clinic_queue:", data);

    return setState(s => {
      const queue = [...s.queue, patient].sort(sortPatients);

      return {
        ...s,
        queue,
        counter: s.counter + 1,
        totalToday: s.totalToday + 1,
      };
    });
  }

  function sortPatients(a, b) {
    return (
      (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2) ||
      a.addedAt - b.addedAt
    );
  }

  function assignToDoctor(doctorId, patientId) {
    return setState(s => {
      const patient = s.queue.find(p => String(p.id) === String(patientId));
      if (!patient) return s;

      const queue = s.queue.filter(p => String(p.id) !== String(patientId));

      const doctors = s.doctors.map(d => {
        if (String(d.id) !== String(doctorId)) return d;

        return {
          ...d,
          available: false,
          currentPatient: {
            ...patient,
            status: "assigned",
            serveStart: Date.now(),
          },
        };
      });

      supabase
        .from("clinic_queue")
        .update({ status: "assigned", updated_at: new Date().toISOString() })
        .eq("id", patient.id)
        .then(({ error }) => {
          if (error) console.error("Failed to update status to assigned:", error);
        });

      return { ...s, queue, doctors };
    });
  }

  function callNextForDoctor(doctorId) {
    return setState(s => {
      const doc = s.doctors.find(d => String(d.id) === String(doctorId));
      if (!doc || !doc.available) return s;

      let queue = [...s.queue];
      let completed = [...s.completed];
      let waitTimes = [...s.waitTimes];
      const currentPatient = doc.currentPatient;

      if (currentPatient) {
        const duration = Math.max(1, Math.round((Date.now() - currentPatient.serveStart) / 60000));

        completed = [
          {
            ...currentPatient,
            duration,
            doctorName: doc.name,
            completedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
          ...completed,
        ];

        waitTimes.push(duration);

        supabase
          .from("clinic_queue")
          .update({ status: "done", updated_at: new Date().toISOString() })
          .eq("id", currentPatient.id)
          .then(({ error }) => {
            if (error) console.error("Failed to mark current patient as done:", error);
          });
      }

      const nextPatient = queue.find(p => p.dept === doc.dept);

      if (!nextPatient) {
        const doctors = s.doctors.map(d =>
          String(d.id) === String(doctorId)
            ? { ...d, available: true, currentPatient: null }
            : d
        );

        return { ...s, doctors, completed, waitTimes };
      }

      queue = queue.filter(p => String(p.id) !== String(nextPatient.id));

      supabase
        .from("clinic_queue")
        .update({ status: "assigned", updated_at: new Date().toISOString() })
        .eq("id", nextPatient.id)
        .then(({ error }) => {
          if (error) console.error("Failed to assign next patient:", error);
        });

      const doctors = s.doctors.map(d =>
        String(d.id) === String(doctorId)
          ? {
              ...d,
              available: false,
              currentPatient: {
                ...nextPatient,
                status: "assigned",
                serveStart: Date.now(),
              },
            }
          : d
      );

      return { ...s, doctors, queue, completed, waitTimes };
    });
  }

  function completeDoctor(doctorId) {
    return setState(s => {
      const doc = s.doctors.find(d => String(d.id) === String(doctorId));
      if (!doc || !doc.currentPatient) return s;

      const patient = doc.currentPatient;
      const duration = Math.max(1, Math.round((Date.now() - patient.serveStart) / 60000));

      supabase
        .from("clinic_queue")
        .update({ status: "done", updated_at: new Date().toISOString() })
        .eq("id", patient.id)
        .then(({ error }) => {
          if (error) console.error("Failed to mark patient as done:", error);
        });

      const doctors = s.doctors.map(d =>
        String(d.id) === String(doctorId)
          ? { ...d, available: true, currentPatient: null }
          : d
      );

      const completed = [
        {
          ...patient,
          duration,
          doctorName: doc.name,
          completedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
        ...s.completed,
      ];

      return { ...s, doctors, completed, waitTimes: [...s.waitTimes, duration] };
    });
  }

  async function loadDoctorsFromSupabase() {
    const { data, error } = await supabase
      .from("Staff")
      .select("*")
      .eq("ClinicID", CLINIC_ID);

    if (error) {
      console.error("Failed to load doctors from Supabase:", error);
      alert("Could not load doctors. Check that your table is named Staff and has ClinicID = 00001. Error: " + error.message);
      setState(s => ({ ...s, doctors: [] }));
      return;
    }

    const doctors = (data || []).map(row => ({
      id: row.StaffID || row.id || row.staff_id,
      name: row.Name || row.full_name || row.name || row.StaffName || "Unknown doctor",
      dept: normalizeDept(row.Department || row.dept || row.Specialty || row.specialty || row.Type || row.type),
      room: row.Room || row.room || row.RoomNo || "Room ?",
      available: true,
      currentPatient: null,
    })).filter(d => d.id);

    setState(s => ({ ...s, doctors }));
  }

  async function loadQueueFromSupabase() {
    const { data, error } = await supabase
      .from("clinic_queue")
      .select("*")
      .eq("ClinicID", CLINIC_ID)
      .eq("status", "waiting")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Failed to load queue from Supabase:", error);
      alert("Could not load queue: " + error.message);
      return;
    }

    setState(s => ({
      ...s,
      queue: (data || []).map((row, index) => ({
        id: row.id,
        num: index + 1,
        name: row.patient_name || "Unknown patient",
        // clinic_queue does not currently have department/priority columns, so existing DB rows default to GP/normal.
        dept: normalizeDept(row.dept || row.department || "GP"),
        priority: row.priority || "normal",
        addedAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
        status: row.status || "waiting",
        doctorId: null,
      })).sort(sortPatients),
      counter: (data || []).length + 1,
      totalToday: (data || []).length,
    }));
  }

  function skipDoctor(doctorId) {
    return setState(s => {
      const doc = s.doctors.find(d => String(d.id) === String(doctorId));
      if (!doc || !doc.currentPatient) return s;

      const patient = doc.currentPatient;

      supabase
        .from("clinic_queue")
        .update({ status: "waiting", updated_at: new Date().toISOString() })
        .eq("id", patient.id)
        .then(({ error }) => {
          if (error) console.error("Failed to skip patient:", error);
        });

      const skippedPatient = {
        ...patient,
        status: "waiting",
        serveStart: null,
        addedAt: Date.now(),
      };

      const doctors = s.doctors.map(d =>
        String(d.id) === String(doctorId)
          ? { ...d, available: true, currentPatient: null }
          : d
      );

      return { ...s, doctors, queue: [...s.queue, skippedPatient].sort(sortPatients) };
    });
  }

  function removeFromQueue(patientId) {
    supabase
      .from("clinic_queue")
      .update({ status: "removed", updated_at: new Date().toISOString() })
      .eq("id", patientId)
      .then(({ error }) => {
        if (error) console.error("Failed to remove patient from Supabase:", error);
      });

    return setState(s => ({
      ...s,
      queue: s.queue.filter(p => String(p.id) !== String(patientId)),
    }));
  }

  function addDoctor(name, dept, room) {
    return setState(s => ({
      ...s,
      doctors: [
        ...s.doctors,
        {
          id: "doc_" + Date.now(),
          name,
          dept: normalizeDept(dept),
          room,
          available: true,
          currentPatient: null,
        },
      ],
    }));
  }

  function removeDoctor(doctorId) {
    return setState(s => ({
      ...s,
      doctors: s.doctors.filter(d => String(d.id) !== String(doctorId)),
    }));
  }

  function toggleDoctorAvailability(doctorId) {
    return setState(s => ({
      ...s,
      doctors: s.doctors.map(d =>
        String(d.id) === String(doctorId)
          ? { ...d, available: d.currentPatient ? d.available : !d.available }
          : d
      ),
    }));
  }

  function resetDay() {
    localStorage.removeItem(STORAGE_KEY);
    setState(() => ({
      queue: [],
      completed: [],
      doctors: [],
      counter: 1,
      totalToday: 0,
      waitTimes: [],
      lastUpdated: Date.now(),
    }));
  }

  return {
    getState,
    setState,
    subscribe,
    addPatient,
    loadQueueFromSupabase,
    loadDoctorsFromSupabase,
    assignToDoctor,
    callNextForDoctor,
    completeDoctor,
    skipDoctor,
    removeFromQueue,
    addDoctor,
    removeDoctor,
    toggleDoctorAvailability,
    resetDay,
    PRIORITY_ORDER,
    DEPT_LABELS,
  };
})();
