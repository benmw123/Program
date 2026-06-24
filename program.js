/* ============================================================
   PROGRAM DATA
   A 3-day Push / Pull / Legs split built around the equipment
   on hand, structured as a 6-week mesocycle (5 weeks of
   progressive overload + 1 deload week), per the training
   fundamentals in Bigger Leaner Stronger:
     - Compound lifts trained in lower rep ranges (4-8) with
       1-2 RIR (reps in reserve)
     - Isolation / accessory work in higher rep ranges (8-15)
     - Double progression: add reps within the target range,
       then add weight and drop back to the bottom of the range
     - A deload week every 6th week: ~50% volume, higher RIR,
       lighter loads, to dissipate fatigue before the next block
   ============================================================ */

const MESOCYCLE_LENGTH = 6; // weeks (5 overload + 1 deload)
const DELOAD_WEEK = 6;

const PROGRAM = {
  days: [
    {
      id: "push",
      name: "Push",
      subtitle: "Chest \u00b7 Shoulders \u00b7 Triceps",
      exercises: [
        {
          id: "smith_bench_press",
          name: "Smith Machine Bench Press",
          equipment: "Smith machine",
          cue: "Bar over mid-chest, elbows ~45\u00b0, control the descent.",
          sets: 4,
          repLow: 4,
          repHigh: 6,
          rir: "1-2",
          restSeconds: 150,
          type: "compound"
        },
        {
          id: "smith_ohp",
          name: "Smith Machine Overhead Press",
          equipment: "Smith machine",
          cue: "Bar path straight up from collarbone, ribs down.",
          sets: 3,
          repLow: 6,
          repHigh: 8,
          rir: "1-2",
          restSeconds: 120,
          type: "compound"
        },
        {
          id: "db_incline_press",
          name: "Dumbbell Incline Press",
          equipment: "Dumbbells + bench",
          cue: "Bench ~30\u00b0. Press up and slightly in, squeeze chest at top.",
          sets: 3,
          repLow: 8,
          repHigh: 10,
          rir: "1-2",
          restSeconds: 90,
          type: "compound"
        },
        {
          id: "cable_lateral_raise",
          name: "Cable Lateral Raise",
          equipment: "Functional trainer, low pulley",
          cue: "Lead with elbow, raise to shoulder height, control the negative.",
          sets: 3,
          repLow: 12,
          repHigh: 15,
          rir: "1",
          restSeconds: 60,
          type: "isolation"
        },
        {
          id: "cable_fly",
          name: "Cable Chest Fly",
          equipment: "Functional trainer, both pulleys",
          cue: "Slight forward lean, arc the hands together at chest height.",
          sets: 2,
          repLow: 10,
          repHigh: 12,
          rir: "1",
          restSeconds: 60,
          type: "isolation"
        },
        {
          id: "cable_triceps_pushdown",
          name: "Cable Triceps Pushdown",
          equipment: "Functional trainer, rope attachment",
          cue: "Elbows pinned to sides, full extension, no swinging.",
          sets: 3,
          repLow: 10,
          repHigh: 12,
          rir: "1",
          restSeconds: 60,
          type: "isolation"
        }
      ]
    },
    {
      id: "pull",
      name: "Pull",
      subtitle: "Back \u00b7 Biceps \u00b7 Rear Delts",
      exercises: [
        {
          id: "lat_pulldown",
          name: "Lat Pulldown",
          equipment: "Plate-loaded lat pulldown/row machine",
          cue: "Drive elbows down and back, chest up, pause at bottom.",
          sets: 4,
          repLow: 6,
          repHigh: 8,
          rir: "1-2",
          restSeconds: 120,
          type: "compound"
        },
        {
          id: "seated_cable_row",
          name: "Seated Cable Row",
          equipment: "Plate-loaded lat pulldown/row machine",
          cue: "Drive elbows back, squeeze shoulder blades, slow return.",
          sets: 3,
          repLow: 8,
          repHigh: 10,
          rir: "1-2",
          restSeconds: 90,
          type: "compound"
        },
        {
          id: "smith_bent_over_row",
          name: "Smith Machine Bent-Over Row",
          equipment: "Smith machine",
          cue: "Hinge at hips ~45\u00b0, pull bar to lower ribs, flat back.",
          sets: 3,
          repLow: 6,
          repHigh: 8,
          rir: "1-2",
          restSeconds: 120,
          type: "compound"
        },
        {
          id: "cable_face_pull",
          name: "Cable Face Pull",
          equipment: "Functional trainer, rope attachment",
          cue: "Pull to face height, rotate hands back, squeeze rear delts.",
          sets: 3,
          repLow: 12,
          repHigh: 15,
          rir: "1",
          restSeconds: 60,
          type: "isolation"
        },
        {
          id: "db_biceps_curl",
          name: "Dumbbell Biceps Curl",
          equipment: "Dumbbells",
          cue: "Elbows pinned at sides, no swinging, squeeze at top.",
          sets: 3,
          repLow: 8,
          repHigh: 10,
          rir: "1",
          restSeconds: 60,
          type: "isolation"
        },
        {
          id: "cable_hammer_curl",
          name: "Cable Hammer Curl",
          equipment: "Functional trainer, rope attachment",
          cue: "Neutral grip, control the eccentric, no body english.",
          sets: 2,
          repLow: 10,
          repHigh: 12,
          rir: "1",
          restSeconds: 60,
          type: "isolation"
        }
      ]
    },
    {
      id: "legs",
      name: "Legs",
      subtitle: "Quads \u00b7 Hamstrings \u00b7 Glutes \u00b7 Calves",
      exercises: [
        {
          id: "smith_squat",
          name: "Smith Machine Squat",
          equipment: "Smith machine",
          cue: "Feet slightly forward of bar path, sit back, full depth.",
          sets: 4,
          repLow: 4,
          repHigh: 6,
          rir: "1-2",
          restSeconds: 150,
          type: "compound"
        },
        {
          id: "leg_press",
          name: "Leg Press",
          equipment: "Plate-loaded leg press/calf raise machine",
          cue: "Feet shoulder width, lower until knees ~90\u00b0, drive through heels.",
          sets: 3,
          repLow: 8,
          repHigh: 10,
          rir: "1-2",
          restSeconds: 120,
          type: "compound"
        },
        {
          id: "db_romanian_deadlift",
          name: "Dumbbell Romanian Deadlift",
          equipment: "Dumbbells",
          cue: "Soft knees, push hips back, feel hamstring stretch, neutral spine.",
          sets: 3,
          repLow: 8,
          repHigh: 10,
          rir: "1-2",
          restSeconds: 90,
          type: "compound"
        },
        {
          id: "leg_curl",
          name: "Leg Curl",
          equipment: "Plate-loaded leg extension/curl machine",
          cue: "Full stretch at the bottom, squeeze hamstrings at top.",
          sets: 3,
          repLow: 10,
          repHigh: 12,
          rir: "1",
          restSeconds: 75,
          type: "isolation"
        },
        {
          id: "leg_extension",
          name: "Leg Extension",
          equipment: "Plate-loaded leg extension/curl machine",
          cue: "Controlled tempo, slight pause at the top, no jerking.",
          sets: 3,
          repLow: 10,
          repHigh: 12,
          rir: "1",
          restSeconds: 75,
          type: "isolation"
        },
        {
          id: "calf_raise",
          name: "Calf Raise",
          equipment: "Plate-loaded leg press/calf raise machine",
          cue: "Full stretch at bottom, pause and squeeze hard at top.",
          sets: 3,
          repLow: 12,
          repHigh: 15,
          rir: "1",
          restSeconds: 60,
          type: "isolation"
        }
      ]
    }
  ]
};

/* Build a flat lookup of every exercise id -> exercise definition */
const EXERCISE_INDEX = {};
PROGRAM.days.forEach(day => {
  day.exercises.forEach(ex => {
    EXERCISE_INDEX[ex.id] = { ...ex, dayId: day.id };
  });
});

/* Returns the effective set count + RIR target for a given week,
   applying the deload reduction on week 6 */
function getWeekAdjustedTarget(exercise, week) {
  if (week === DELOAD_WEEK) {
    return {
      sets: Math.max(2, Math.round(exercise.sets * 0.5)),
      repLow: exercise.repLow,
      repHigh: exercise.repHigh,
      rir: "4-5",
      restSeconds: exercise.restSeconds,
      isDeload: true
    };
  }
  return {
    sets: exercise.sets,
    repLow: exercise.repLow,
    repHigh: exercise.repHigh,
    rir: exercise.rir,
    restSeconds: exercise.restSeconds,
    isDeload: false
  };
}

export { PROGRAM, EXERCISE_INDEX, MESOCYCLE_LENGTH, DELOAD_WEEK, getWeekAdjustedTarget };

