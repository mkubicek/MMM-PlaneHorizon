/* What aircraft is it: readable type names, short airline names and planform silhouettes
 * (seen from below, nose up). Browser global PlaneHorizonAircraft, or require() in the tests. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PlaneHorizonAircraft = factory();
})(this, function () {
  // ICAO type designator -> [readable name, silhouette]. Covers what typically passes over Zürich.
  const TYPES = {
    A318: ['Airbus A318', 'narrow'], A319: ['Airbus A319', 'narrow'], A320: ['Airbus A320', 'narrow'], A321: ['Airbus A321', 'narrow'],
    A19N: ['Airbus A319neo', 'narrow'], A20N: ['Airbus A320neo', 'narrow'], A21N: ['Airbus A321neo', 'narrow'],
    BCS1: ['Airbus A220-100', 'narrow'], BCS3: ['Airbus A220-300', 'narrow'],
    A332: ['Airbus A330-200', 'wide'], A333: ['Airbus A330-300', 'wide'], A338: ['Airbus A330-800', 'wide'], A339: ['Airbus A330-900', 'wide'],
    A343: ['Airbus A340-300', 'quad'], A346: ['Airbus A340-600', 'quad'], A359: ['Airbus A350-900', 'wide'], A35K: ['Airbus A350-1000', 'wide'],
    A388: ['Airbus A380', 'quad'], A306: ['Airbus A300-600', 'wide'], A310: ['Airbus A310', 'wide'],
    B733: ['Boeing 737-300', 'narrow'], B734: ['Boeing 737-400', 'narrow'], B737: ['Boeing 737-700', 'narrow'], B738: ['Boeing 737-800', 'narrow'],
    B739: ['Boeing 737-900', 'narrow'], B37M: ['Boeing 737 MAX 7', 'narrow'], B38M: ['Boeing 737 MAX 8', 'narrow'], B39M: ['Boeing 737 MAX 9', 'narrow'],
    B752: ['Boeing 757-200', 'narrow'], B753: ['Boeing 757-300', 'narrow'], B762: ['Boeing 767-200', 'wide'], B763: ['Boeing 767-300', 'wide'], B764: ['Boeing 767-400', 'wide'],
    B744: ['Boeing 747-400', 'quad'], B748: ['Boeing 747-8', 'quad'], B772: ['Boeing 777-200', 'wide'], B77L: ['Boeing 777-200LR', 'wide'],
    B77W: ['Boeing 777-300ER', 'wide'], B778: ['Boeing 777-8', 'wide'], B779: ['Boeing 777-9', 'wide'],
    B788: ['Boeing 787-8', 'wide'], B789: ['Boeing 787-9', 'wide'], B78X: ['Boeing 787-10', 'wide'],
    E170: ['Embraer E170', 'narrow'], E75L: ['Embraer E175', 'narrow'], E75S: ['Embraer E175', 'narrow'], E190: ['Embraer E190', 'narrow'], E195: ['Embraer E195', 'narrow'],
    E290: ['Embraer E190-E2', 'narrow'], E295: ['Embraer E195-E2', 'narrow'],
    CRJ2: ['Bombardier CRJ200', 'tailjet'], CRJ7: ['Bombardier CRJ700', 'tailjet'], CRJ9: ['Bombardier CRJ900', 'tailjet'], CRJX: ['Bombardier CRJ1000', 'tailjet'],
    DH8D: ['De Havilland Dash 8-400', 'prop'], AT43: ['ATR 42-300', 'prop'], AT45: ['ATR 42-500', 'prop'], AT46: ['ATR 42-600', 'prop'],
    AT72: ['ATR 72', 'prop'], AT75: ['ATR 72-500', 'prop'], AT76: ['ATR 72-600', 'prop'], SF34: ['Saab 340', 'prop'], D328: ['Dornier 328', 'prop'],
    PC12: ['Pilatus PC-12', 'prop'], PC24: ['Pilatus PC-24', 'tailjet'], PC6T: ['Pilatus Porter', 'light'], PC21: ['Pilatus PC-21', 'light'], PC7: ['Pilatus PC-7', 'light'],
    C25A: ['Cessna Citation CJ2', 'tailjet'], C25B: ['Cessna Citation CJ3', 'tailjet'], C25C: ['Cessna Citation CJ4', 'tailjet'], C510: ['Cessna Citation Mustang', 'tailjet'],
    C525: ['Cessna CitationJet', 'tailjet'], C560: ['Cessna Citation V', 'tailjet'], C56X: ['Cessna Citation Excel', 'tailjet'], C680: ['Cessna Citation Sovereign', 'tailjet'],
    C68A: ['Cessna Citation Latitude', 'tailjet'], C700: ['Cessna Citation Longitude', 'tailjet'], E50P: ['Embraer Phenom 100', 'tailjet'], E55P: ['Embraer Phenom 300', 'tailjet'],
    E545: ['Embraer Praetor 500', 'tailjet'], E550: ['Embraer Praetor 600', 'tailjet'], CL30: ['Bombardier Challenger 300', 'tailjet'], CL35: ['Bombardier Challenger 350', 'tailjet'],
    CL60: ['Bombardier Challenger 600', 'tailjet'], GL5T: ['Bombardier Global 5000', 'tailjet'], GLEX: ['Bombardier Global Express', 'tailjet'], GL7T: ['Bombardier Global 7500', 'tailjet'],
    GLF4: ['Gulfstream IV', 'tailjet'], GLF5: ['Gulfstream V', 'tailjet'], GLF6: ['Gulfstream G650', 'tailjet'], G280: ['Gulfstream G280', 'tailjet'],
    F2TH: ['Dassault Falcon 2000', 'tailjet'], FA7X: ['Dassault Falcon 7X', 'tailjet'], FA8X: ['Dassault Falcon 8X', 'tailjet'], FA50: ['Dassault Falcon 50', 'tailjet'],
    LJ45: ['Learjet 45', 'tailjet'], LJ75: ['Learjet 75', 'tailjet'], HDJT: ['HondaJet', 'tailjet'], SF50: ['Cirrus Vision Jet', 'tailjet'],
    C172: ['Cessna 172', 'light'], C182: ['Cessna 182', 'light'], C152: ['Cessna 152', 'light'], C208: ['Cessna Caravan', 'light'], P28A: ['Piper Cherokee', 'light'],
    PA46: ['Piper Malibu', 'light'], DA40: ['Diamond DA40', 'light'], DA42: ['Diamond DA42', 'light'], DA62: ['Diamond DA62', 'light'], SR22: ['Cirrus SR22', 'light'],
    SR20: ['Cirrus SR20', 'light'], TBM9: ['Daher TBM 900', 'light'], TBM8: ['Daher TBM 850', 'light'], BE20: ['Beechcraft King Air 200', 'prop'], B350: ['Beechcraft King Air 350', 'prop'],
    EC35: ['Airbus H135', 'heli'], EC45: ['Airbus H145', 'heli'], H145: ['Airbus H145', 'heli'], EC30: ['Airbus H130', 'heli'], AS50: ['Airbus H125', 'heli'],
    EC20: ['Airbus H120', 'heli'], A109: ['Leonardo AW109', 'heli'], A139: ['Leonardo AW139', 'heli'], A169: ['Leonardo AW169', 'heli'], R44: ['Robinson R44', 'heli'], R22: ['Robinson R22', 'heli'],
    B06: ['Bell 206', 'heli'], B429: ['Bell 429', 'heli'], AS32: ['Airbus Super Puma', 'heli'], NH90: ['NH90', 'heli'],
    C130: ['Lockheed C-130 Hercules', 'prop'], A400: ['Airbus A400M', 'prop'], F18H: ['F/A-18 Hornet', 'fighter'], F18S: ['F/A-18 Hornet', 'fighter'], F35: ['F-35 Lightning II', 'fighter'],
  };

  // Airline ICAO prefix -> name, when the route lookup has nothing.
  const AIRLINES = {
    SWR: 'SWISS', EDW: 'Edelweiss', DLH: 'Lufthansa', EZY: 'easyJet', EJU: 'easyJet', EZS: 'easyJet Switzerland', BAW: 'British Airways', AFR: 'Air France',
    KLM: 'KLM', AUA: 'Austrian', UAE: 'Emirates', QTR: 'Qatar Airways', THY: 'Turkish Airlines', RYR: 'Ryanair', WZZ: 'Wizz Air', UAL: 'United', DAL: 'Delta',
    AAL: 'American', ACA: 'Air Canada', SIA: 'Singapore Airlines', CPA: 'Cathay Pacific', ETD: 'Etihad', ELY: 'El Al', TAP: 'TAP', IBE: 'Iberia', VLG: 'Vueling',
    SAS: 'SAS', FIN: 'Finnair', BEL: 'Brussels Airlines', LOT: 'LOT', AEE: 'Aegean', ITY: 'ITA Airways', CTN: 'Croatia Airlines', HBN: 'Helvetic', GWI: 'Eurowings',
    EWG: 'Eurowings', CFG: 'Condor', TUI: 'TUI', TVS: 'Smartwings', PGT: 'Pegasus', SXS: 'SunExpress', ELL: 'Air Baltic', BTI: 'airBaltic', CSA: 'Czech Airlines',
    REGA: 'Rega', SUI: 'Schweizer Luftwaffe', SWU: 'Swiss Air-Rescue', FDX: 'FedEx', UPS: 'UPS', DHK: 'DHL', BCS: 'DHL', CLX: 'Cargolux', SVA: 'Saudia', AIC: 'Air India',
    CCA: 'Air China', CES: 'China Eastern', KAL: 'Korean Air', JAL: 'Japan Airlines', ANA: 'ANA', ETH: 'Ethiopian', MSR: 'EgyptAir', RAM: 'Royal Air Maroc',
    TAR: 'Tunisair', DAH: 'Air Algérie', OMA: 'Oman Air', GFA: 'Gulf Air', KAC: 'Kuwait Airways', ICE: 'Icelandair', NAX: 'Norwegian', NOZ: 'Norwegian', NSZ: 'Norwegian',
    EXS: 'Jet2', TOM: 'TUI', AZA: 'ITA Airways', VOE: 'Volotea', LGL: 'Luxair', ADR: 'Air Serbia', ASL: 'Air Serbia', BUC: 'Bulgarian Air Charter', ROT: 'TAROM',
  };

  function identify(ac, info = {}) {
    info = info || {};
    const code = (info.icaoType || '').toUpperCase();
    const known = TYPES[code];
    const fallbackName = info.manufacturer && info.type ? `${info.manufacturer} ${info.type.split(' ')[0]}` : code || null;
    const cs = (ac.callsign || '').trim();
    const prefix = /^[A-Z]{3}\d/.test(cs) ? cs.slice(0, 3) : null;
    const shape = (known && known[1]) || guessShape(ac, code);
    return {
      typeName: (known && known[0]) || fallbackName,
      shape,
      airline: AIRLINES[prefix] || info.operator || (prefix ? null : cs || null), // curated short names first
      flight: (/^([A-Z]{2}|[A-Z]\d|\d[A-Z])\d/.test(info.flight || '') ? info.flight : null) || cs || ac.icao24.toUpperCase(),
      registration: info.registration,
    };
  }

  // OpenSky emitter category, then speed/altitude, when the type is unknown.
  function guessShape(ac, code) {
    if (ac.category === 8) return 'heli';
    if (ac.category === 6) return 'wide';
    if (ac.category === 2) return 'light';
    if (/^(EC|AS|R2|R4|H1|B06|A1)/.test(code)) return 'heli';
    if ((ac.v || 0) < 80 && (ac.alt || 0) < 3000) return 'light';
    return 'narrow';
  }

  // Planforms in a 64×64 box, nose up, centred on 32,32: what you see when it passes over you.
  const SILHOUETTES = {
    narrow: `<path d="M32 4c2 0 2.6 3 2.6 6v14.5L60 37.5v3L34.6 34v17.5L42.5 57v2.5L33.4 57.6 32 61l-1.4-3.4-9.1 1.9V57l7.9-5.5V34L4 40.5v-3l25.4-13V10c0-3 .6-6 2.6-6z"/>
      <rect x="17.3" y="29.5" width="3" height="6.5" rx="1.4"/><rect x="43.7" y="29.5" width="3" height="6.5" rx="1.4"/>`,
    wide: `<path d="M32 1c2.6 0 3.4 3.5 3.4 7v14.5L63 37.5v3L35.4 33.5v18.5L45 58.5v2.5l-11.6-2L32 63l-1.4-4-11.6 2v-2.5l9.6-6.5V33.5L1 40.5v-3l27.6-15V8c0-3.5.8-7 3.4-7z"/>
      <rect x="15.5" y="28.5" width="3.6" height="8" rx="1.7"/><rect x="44.9" y="28.5" width="3.6" height="8" rx="1.7"/>`,
    quad: `<path d="M32 1c2.8 0 3.6 3.5 3.6 7v13L63 37v3.2L35.6 32v19l9.6 7v2.6l-11.8-2L32 63l-1.4-4-11.8 2v-2.6l9.6-7V32L1 40.2V37l27.4-16V8c0-3.5.8-7 3.6-7z"/>
      <rect x="18" y="27" width="3" height="7" rx="1.4"/><rect x="43" y="27" width="3" height="7" rx="1.4"/><rect x="8.5" y="32" width="3" height="6.5" rx="1.4"/><rect x="52.5" y="32" width="3" height="6.5" rx="1.4"/>`,
    tailjet: `<path d="M32 8c1.8 0 2.4 2.6 2.4 5v14L55 33.5v2.8L34.4 33v17h0l1.6 0v2.5l9 4.5V60l-11.3-1.2L32 61l-1.7-2.2L19 60v-3l9-4.5V50h1.6V33L9 36.3v-2.8L29.6 27V13c0-2.4.6-5 2.4-5z"/>
      <rect x="25.6" y="42" width="3" height="7" rx="1.4"/><rect x="35.4" y="42" width="3" height="7" rx="1.4"/>`,
    prop: `<path d="M32 7c1.8 0 2.4 2.6 2.4 5v13.5H61v4.5H34.4v22l8.6 3.5V58l-9.6-1L32 60l-1.4-3-9.6 1v-2.5l8.6-3.5V30H3v-4.5h26.6V12c0-2.4.6-5 2.4-5z"/>
      <rect x="18" y="21" width="3.4" height="9" rx="1.5"/><rect x="42.6" y="21" width="3.4" height="9" rx="1.5"/><path d="M14.5 21h10.5M39 21h10.5" class="prop"/>`,
    light: `<path d="M32 12c1.6 0 2.2 2 2.2 4v6H58v4.5H34.2v22l6.8 2.5V53l-8-.5-1 3-1-3-8 .5v-2l6.8-2.5v-22H6V22h23.8v-6c0-2 .6-4 2.2-4z"/><path d="M27 12h10" class="prop"/>`,
    heli: `<circle cx="32" cy="30" r="21" class="rotor"/><path d="M32 20c3.4 0 5 3.4 5 8.5s-2 8.5-3.6 9.6V56h3.4v2.2h-9.6V56h3.4V38.1C29 37 27 33.6 27 28.5S28.6 20 32 20z"/>`,
    fighter: `<path d="M32 2l3 12 1.5 10L56 40v4l-19-6-1 10 7 6v3l-10-2-1 3-1-3-10 2v-3l7-6-1-10-19 6v-4l19.5-16L29 14z"/>`,
  };

  // Hairlines stay 1 px at any size; rotor/propeller lines are never filled.
  function silhouetteDefs(prefix) {
    prefix = prefix || 'sil';
    const prep = d => d.replace(/<(path|rect|circle)/g, '<$1 vector-effect="non-scaling-stroke"')
      .replace(/class="prop"/g, 'fill="none" stroke-linecap="round"')
      .replace(/class="rotor"/g, 'fill="none" stroke-dasharray="2 3" opacity=".6"');
    return `<defs>${Object.entries(SILHOUETTES).map(([k, d]) => `<symbol id="${prefix}-${k}" viewBox="0 0 64 64" overflow="visible">${prep(d)}</symbol>`).join('')}</defs>`;
  }

  // "Airbus A320" -> "A320", but "Cessna 172" stays whole: a bare number says nothing.
  const MAKERS = /^(Airbus|Boeing|Embraer|Bombardier|De Havilland|Cessna|Dassault|Gulfstream|Pilatus|Leonardo|Beechcraft|Daher|Diamond|Cirrus|Piper|Robinson|Bell|Lockheed) (.+)$/;
  function shortType(name) {
    const m = (name || "").match(MAKERS);
    if (!m) return name || "";
    return /^\d/.test(m[2]) && !/^(Airbus|Boeing)$/.test(m[1]) ? name : m[2];
  }

  return { TYPES, AIRLINES, SILHOUETTES, identify, silhouetteDefs, shortType };
});
