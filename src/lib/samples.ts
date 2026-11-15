/**
 * Built-in example guides. These are hand-written reference data — never shown as AI output.
 * They are tagged "Example" in the UI and are not synced to Firestore.
 * All live guidance is generated through Firebase AI Logic (see engine/firebase.ts).
 */
import type { CategoryId, Session, Solution } from './types';

interface Entry {
  match: RegExp;
  category: CategoryId;
  solution: Solution;
}

const LIBRARY: Entry[] = [
  {
    match: /(laptop|computer|pc|notebook).*(overheat|hot|heat|shut|fan)|(overheat|hot).*(laptop|computer)/i,
    category: 'electronics',
    solution: {
      title: 'Laptop overheating and thermal shutdown',
      summary:
        'The laptop is most likely hitting its thermal limit and shutting down to protect the CPU. Restricted airflow or a struggling fan is the usual culprit.',
      severity: 'medium',
      causes: [
        { title: 'Dust blocking the cooling vents', detail: 'Lint and dust build up on the heatsink fins and intake grilles, choking airflow.', likelihood: 'high' },
        { title: 'Sustained high CPU or GPU load', detail: 'Background processes, browser tabs or games can pin the processor at full power.', likelihood: 'high' },
        { title: 'Cooling fan malfunction', detail: 'A worn bearing or failed fan cannot move enough air — often noisy or silent when it should spin.', likelihood: 'medium' },
        { title: 'Poor ventilation surface', detail: 'Beds, cushions and laps cover the bottom intake vents.', likelihood: 'medium' },
        { title: 'Dried-out thermal paste', detail: 'On machines older than 3–4 years, paste between CPU and heatsink degrades.', likelihood: 'low' },
      ],
      steps: [
        { title: 'Power off and let it cool', detail: 'Shut down fully and unplug the charger. Wait at least 15 minutes before touching the vents.' },
        { title: 'Move to a hard, flat surface', detail: 'Use a desk or table so the bottom intake vents are not obstructed. A stand helps.' },
        { title: 'Inspect and clear the vents', detail: 'With the laptop off, blow short bursts of compressed air into the vents. Hold the fan still with a toothpick so it does not over-spin.' },
        { title: 'Check what is using the CPU', detail: 'After restarting, open Task Manager (Ctrl+Shift+Esc) or Activity Monitor and end runaway processes.' },
        { title: 'Listen to the fan under load', detail: 'Run something demanding for a minute. Grinding, clicking or no fan sound at all points to a failing fan.' },
        { title: 'Switch to a balanced power plan', detail: 'Lower the maximum processor state or use a battery-saver profile to reduce heat output.' },
      ],
      safety: [
        'Never open the laptop case while it is powered on or plugged in.',
        'Stop using it immediately if you notice battery swelling, smoke or a burning smell.',
        'Do not use a vacuum cleaner directly on internal components — it can cause static discharge.',
      ],
      ifNotResolved: [
        'Update the BIOS/UEFI and chipset drivers — vendors often ship improved fan curves.',
        'Have the cooling system inspected and the thermal paste replaced by a technician.',
        'Back up your data in case the shutdowns are caused by a failing component.',
      ],
      seekProfessional: false,
    },
  },
  {
    match: /(wi-?fi|wifi|internet|router|network).*(drop|disconnect|slow|keeps|lost|cut)/i,
    category: 'network',
    solution: {
      title: 'Wi-Fi connection keeps dropping',
      summary:
        'Intermittent drops usually come from interference, router overheating or outdated firmware rather than the internet line itself.',
      severity: 'low',
      causes: [
        { title: 'Channel congestion or interference', detail: 'Neighbouring networks, microwaves and Bluetooth devices crowd the 2.4 GHz band.', likelihood: 'high' },
        { title: 'Router overheating or memory leak', detail: 'Consumer routers degrade after days of uptime and start dropping clients.', likelihood: 'medium' },
        { title: 'Outdated router firmware or device drivers', detail: 'Known bugs in older firmware cause periodic disconnects.', likelihood: 'medium' },
        { title: 'Weak signal at your location', detail: 'Walls, floors and distance reduce signal below a stable threshold.', likelihood: 'medium' },
      ],
      steps: [
        { title: 'Restart the router and modem', detail: 'Unplug both for 30 seconds, power the modem first, then the router once its lights are stable.' },
        { title: 'Test with a wired connection', detail: 'If Ethernet stays stable, the problem is Wi-Fi, not your internet provider.' },
        { title: 'Move closer and check signal strength', detail: 'If drops stop near the router, coverage is the issue — consider a mesh node or relocating the router.' },
        { title: 'Switch to 5 GHz or change channel', detail: 'In the router admin page, pick a less crowded channel (1, 6 or 11 on 2.4 GHz) or use the 5 GHz band.' },
        { title: 'Update firmware and drivers', detail: 'Install the latest router firmware and your device’s wireless adapter driver.' },
      ],
      safety: [],
      ifNotResolved: [
        'Contact your internet provider and ask them to check line stability and logs.',
        'Factory-reset the router and reconfigure it from scratch.',
        'Replace routers older than about five years — they often lack modern standards.',
      ],
      seekProfessional: false,
    },
  },
  {
    match: /(washing|washer|laundry).*(drain|water|stuck|spin)|(drain).*(washing|washer)/i,
    category: 'appliance',
    solution: {
      title: 'Washing machine not draining',
      summary:
        'A washer that will not drain is almost always blocked — the pump filter, drain hose or standpipe — rather than a failed pump.',
      severity: 'medium',
      causes: [
        { title: 'Clogged drain-pump filter', detail: 'Coins, lint and hair collect in the filter behind the small front panel.', likelihood: 'high' },
        { title: 'Kinked or blocked drain hose', detail: 'A hose pushed against the wall can fold and stop the flow.', likelihood: 'high' },
        { title: 'Blocked standpipe or sink drain', detail: 'The household drain the hose empties into may be clogged.', likelihood: 'medium' },
        { title: 'Failed drain pump', detail: 'A humming sound with no water movement suggests a jammed or burnt-out pump.', likelihood: 'low' },
      ],
      steps: [
        { title: 'Turn off and unplug the machine', detail: 'Also close the water supply taps behind the machine.' },
        { title: 'Prepare for water', detail: 'Lay towels down and place a shallow tray under the filter access panel — expect several litres.' },
        { title: 'Drain and clean the pump filter', detail: 'Open the small front panel, release water through the emergency hose, then unscrew the filter slowly and remove debris.' },
        { title: 'Check the drain hose', detail: 'Pull the machine out, straighten any kinks and flush the hose with water to confirm it is clear.' },
        { title: 'Test with a drain/spin cycle', detail: 'Plug back in and run a drain-only cycle. Listen for the pump.' },
      ],
      safety: [
        'Always unplug the machine before opening any panel — water and mains power are a dangerous combination.',
        'Water inside may be hot if a cycle was interrupted. Let it cool first.',
      ],
      ifNotResolved: [
        'If the pump hums but water does not move, the pump impeller may be jammed or broken.',
        'Book an appliance technician to test and replace the drain pump or control board.',
      ],
      seekProfessional: false,
    },
  },
  {
    match: /(car|engine|vehicle|truck).*(start|crank|click|dead)|(won'?t|doesn'?t|not) start/i,
    category: 'vehicle',
    solution: {
      title: 'Car clicks but will not start',
      summary:
        'A clicking sound on ignition usually means the starter is getting too little current — most often a weak battery or a poor terminal connection.',
      severity: 'medium',
      causes: [
        { title: 'Discharged or weak battery', detail: 'Lights left on, cold weather or an ageing battery leave too little cranking power.', likelihood: 'high' },
        { title: 'Corroded or loose battery terminals', detail: 'White/green build-up or a loose clamp interrupts current under load.', likelihood: 'high' },
        { title: 'Faulty starter motor or solenoid', detail: 'A single loud click with full-brightness lights points to the starter.', likelihood: 'medium' },
        { title: 'Failing alternator', detail: 'If the battery repeatedly dies after driving, it is not being recharged.', likelihood: 'low' },
      ],
      steps: [
        { title: 'Check the dashboard lights', detail: 'Turn the key to ON. Dim or flickering lights point to the battery; bright lights point to the starter.' },
        { title: 'Inspect the battery terminals', detail: 'With the engine off, check that clamps are tight and clean. Remove corrosion with a baking-soda solution and a brush.' },
        { title: 'Jump-start the car', detail: 'Connect red to dead +, red to donor +, black to donor −, black to bare metal on the dead car. Start the donor, wait 3 minutes, then try.' },
        { title: 'Let it run and recharge', detail: 'If it starts, drive for at least 30 minutes to recharge the battery.' },
        { title: 'Test the battery voltage', detail: 'A healthy resting battery reads about 12.6 V. Below 12.2 V it is significantly discharged.' },
      ],
      safety: [
        'Wear eye protection — batteries can vent explosive hydrogen gas.',
        'Never connect the final jump lead to the dead battery’s negative terminal.',
        'Keep hands, hair and clothing clear of belts and fans once the engine runs.',
      ],
      ifNotResolved: [
        'Have the battery load-tested; most auto shops do this for free.',
        'If the battery is good, have the starter and alternator tested by a mechanic.',
      ],
      seekProfessional: false,
    },
  },
  {
    match: /(breaker|fuse|circuit|trip)/i,
    category: 'electrical',
    solution: {
      title: 'Circuit breaker keeps tripping',
      summary:
        'Repeated tripping means the breaker is doing its job: the circuit is overloaded, or there is a short or ground fault somewhere on it.',
      severity: 'high',
      causes: [
        { title: 'Circuit overload', detail: 'Too many high-draw appliances (heaters, kettles, irons) on one circuit.', likelihood: 'high' },
        { title: 'Faulty appliance', detail: 'A damaged cord or internal fault in one device trips the breaker when switched on.', likelihood: 'high' },
        { title: 'Ground fault or moisture', detail: 'Water in an outdoor socket or bathroom fitting creates a leakage path.', likelihood: 'medium' },
        { title: 'Short circuit in wiring', detail: 'Damaged insulation inside walls or a loose connection at a socket.', likelihood: 'low' },
      ],
      steps: [
        { title: 'Unplug everything on the circuit', detail: 'Switch off and unplug all devices on the affected circuit before resetting.' },
        { title: 'Reset the breaker once', detail: 'Push the breaker firmly to OFF, then back to ON. If it trips immediately with nothing connected, stop here.' },
        { title: 'Reconnect devices one at a time', detail: 'Plug devices back in individually, waiting a minute between each, to find the one that trips it.' },
        { title: 'Spread the load', detail: 'Move high-wattage appliances to other circuits so no single circuit is overloaded.' },
        { title: 'Check for moisture or damage', detail: 'Look for scorch marks, melted plugs or damp sockets — but do not open anything.' },
      ],
      safety: [
        'Never tape, hold or otherwise force a breaker to stay on.',
        'Do not open the distribution board or socket faceplates — leave internal work to a licensed electrician.',
        'If you smell burning or see scorch marks, keep the breaker off and call an electrician.',
      ],
      ifNotResolved: [
        'If it trips with nothing connected, there is a wiring fault — call a licensed electrician.',
        'Ask the electrician to check whether the breaker itself is worn and needs replacing.',
      ],
      seekProfessional: true,
    },
  },
  {
    match: /(phone|mobile|iphone|android|tablet).*(charg|battery|power)/i,
    category: 'electronics',
    solution: {
      title: 'Phone not charging',
      summary:
        'Charging failures are most often caused by debris in the port or a damaged cable or adapter, not the battery itself.',
      severity: 'low',
      causes: [
        { title: 'Lint or debris in the charging port', detail: 'Pocket lint compacts in the port and stops the plug seating fully.', likelihood: 'high' },
        { title: 'Damaged cable or adapter', detail: 'Frayed cables and cheap adapters fail intermittently.', likelihood: 'high' },
        { title: 'Software glitch', detail: 'A frozen charging service can stop the phone accepting charge until restarted.', likelihood: 'medium' },
        { title: 'Worn battery or port', detail: 'Older devices may need a battery or port replacement.', likelihood: 'low' },
      ],
      steps: [
        { title: 'Try a different cable and adapter', detail: 'Use a known-good certified charger and a different wall socket.' },
        { title: 'Inspect and clean the port', detail: 'Power off, then gently remove lint with a wooden toothpick. Avoid metal objects.' },
        { title: 'Restart the phone', detail: 'Hold the power button and restart, then plug it in again.' },
        { title: 'Charge while powered off', detail: 'Turn the phone off and leave it on the charger for 30 minutes.' },
      ],
      safety: [
        'Stop charging if the phone becomes very hot, swells or smells of burning.',
        'Do not charge a phone with a damaged or bulging back panel.',
      ],
      ifNotResolved: ['Check battery health in settings.', 'Visit an authorised repair centre to inspect the port and battery.'],
      seekProfessional: false,
    },
  },
];

export function buildSampleSessions(): Session[] {
  const now = Date.now();
  // Built-in example guides (not AI output) so Saved and the offline fallback have content on first launch.
  return LIBRARY.slice(0, 3).map((e, i) => ({
    id: `sample-${i + 1}`,
    createdAt: now - [3 * 36e5, 26 * 36e5, 4 * 864e5][i],
    updatedAt: now - [3 * 36e5, 26 * 36e5, 4 * 864e5][i],
    problem: SAMPLE_PROBLEMS[i],
    category: e.category,
    solution: e.solution,
    source: 'demo',
    model: 'not AI output',
    durationMs: 0,
    completedSteps: [[0, 1], [0, 1, 2, 3, 4], []][i],
    depth: 'quick',
    sample: true,
  }));
}

const SAMPLE_PROBLEMS = [
  'My laptop is overheating and shutting down automatically. What should I do?',
  'Wi-Fi keeps dropping every few minutes on all my devices.',
  'Washing machine finished the cycle but water is not draining out.',
];

export const EXAMPLE_PROMPTS: { text: string; category: CategoryId }[] = [
  { text: 'My laptop is overheating and shutting down automatically. What should I do?', category: 'electronics' },
  { text: 'The circuit breaker in my kitchen keeps tripping when I use the kettle.', category: 'electrical' },
  { text: 'Car makes a clicking sound but won’t start this morning.', category: 'vehicle' },
  { text: 'Washing machine finished the cycle but the water is not draining.', category: 'appliance' },
];
