import exhibitInformation from '../../data/verified-exhibit-information.json';

const normalize = (value = '') => String(value).trim().toLowerCase().replace(/[_-]+/g, ' ');

const OFFLINE_EXHIBIT_MEANINGS = Object.freeze({
  '3d printer': 'A machine that builds a physical object layer by layer from a digital design.',
  'collaborative robot': 'A robot designed to work safely alongside people on shared tasks.',
  fdas: 'A fire detection and alarm system used to identify fire conditions and alert people in a building.',
  'industrial robot': 'A programmable robot used to perform repeatable tasks such as handling, assembly, or processing.',
  'pick place machine': 'An automated machine that picks up components and places them accurately in a new position.',
  'robotic arm': 'A programmable mechanical arm that moves tools or objects through controlled positions.',
  'smart systems': 'Connected technologies that use sensors, software, and control systems to monitor conditions and automate actions.',
  'speech home automation': 'A system that uses spoken commands to control connected devices and home functions.',
  'digital embroidery machine': 'A computer-controlled machine that stitches programmed patterns onto fabric.',
  '3d outputs': 'Physical prototypes or parts produced from digital designs using fabrication equipment.',
  bcn3d: 'A 3D printer platform used to produce physical parts from digital models, including prototypes and functional components.',
  'crealty ender 3d printer': 'A desktop 3D printer that creates physical parts layer by layer from a digital model.',
  'leapfrog bolt pro': 'A professional 3D printer used to turn digital designs into physical prototypes and parts.',
  stratasys: 'A professional additive-manufacturing system used to create accurate physical prototypes and components.',
  vaquform: 'A desktop thermoforming machine that shapes heated plastic sheets over a mould to create formed parts.',
  spectrophotometer: 'A laboratory instrument that measures how much light a sample absorbs or transmits.',
  microscope: 'An optical instrument used to view details that are too small to see clearly with the unaided eye.',
  incubator: 'A controlled chamber used to maintain conditions such as temperature for samples or cultures.',
  centrifuge: 'A laboratory machine that separates materials by spinning samples at high speed.',
  'analytical balance': 'A precision laboratory balance used to measure very small masses accurately.',
  'benchtop multi parameter meter': 'A benchtop instrument that measures several properties of a sample, such as pH, conductivity, or dissolved solids.',
  'biobase vortex mixer': 'A laboratory mixer that rapidly agitates tubes to combine their contents.',
  'chemical testing area': 'A designated laboratory workspace for testing and analyzing chemical samples.',
  'digital dry bath incubator': 'A temperature-controlled block heater that warms tubes or small containers without using water.',
  'ducted fumehood': 'A ventilated enclosure that captures hazardous vapors and exhausts them outside the laboratory.',
  gravimetrics: 'A laboratory measurement approach that determines a quantity from the mass of a sample or precipitate.',
  'hot plate with stirrer': 'A laboratory hot plate that heats a sample while a magnetic stir bar mixes it.',
  img: 'A source-image label from the CAESAR training dataset; it does not identify a specific laboratory instrument.',
  'laboratory glassware': 'Laboratory vessels used to contain, measure, mix, or process samples.',
  'microprocessor centrifuge': 'A programmable centrifuge that separates samples by spinning them at controlled speed and time.',
  nichipet: 'An adjustable micropipette used to transfer small, measured volumes of liquid accurately.',
  'nichipet ex ii': 'An adjustable micropipette used to transfer small, measured volumes of liquid accurately.',
  'nichipet ex ii and biobase vortex mixer': 'A laboratory station combining an adjustable micropipette for liquid transfer with a vortex mixer for rapid sample mixing.',
  'preparation area': 'A designated workspace where samples, materials, or equipment are prepared for laboratory procedures.',
  'shaker incubator': 'A temperature-controlled chamber that gently shakes samples while they incubate.',
  'velocity 18r pro centrifuge': 'A high-speed refrigerated centrifuge used to separate laboratory samples while controlling temperature.',
  'charcoal oven machine': 'A heating machine that uses charcoal as a fuel source to cook or thermally process materials.',
  'festo solar wind training system': 'An educational training system used to demonstrate renewable-energy concepts involving solar power and wind power.',
  'fluke 2042 cable tracer': 'A diagnostic instrument used to locate and trace electrical cables, including cables hidden behind surfaces.',
  'fluke 355 clamp meter': 'A clamp meter used to measure electrical current without disconnecting the conductor, along with other electrical values.',
  'fluke 922 air flow meter': 'An instrument used to measure air velocity, air volume flow, and pressure in ventilation systems.',
  'fluke 930 non contact tachometer': 'A non-contact instrument that measures the rotational speed of a moving shaft or other object.',
  'fluke 941 temperature humidity meter': 'A handheld instrument that measures temperature and relative humidity in the surrounding air.',
  'ip display area': 'A designated display area for presenting information, instructions, or project content to visitors.',
  'quadruple suction single discharge cooking oil transfer device': 'A food-processing device that uses multiple suction points and one discharge path to transfer cooking oil.',
  'root crop slicing machine': 'A food-processing machine that cuts root crops into slices or other consistent pieces.',
  'testo 420 volume flow hood': 'A measurement hood used to determine air volume flow at ventilation outlets such as diffusers and grilles.',
  'testo 440 air velocity iaq': 'A modular measuring instrument used to assess air velocity and indoor-air-quality conditions.',
  'unmanned aerial system': 'An aircraft system operated without a person onboard, commonly used for observation, mapping, or research.',
});

function offlineMeaning(displayName = '') {
  const normalizedName = normalize(displayName);
  if (OFFLINE_EXHIBIT_MEANINGS[normalizedName]) return OFFLINE_EXHIBIT_MEANINGS[normalizedName];
  if (normalizedName.includes('meter')) return 'A measuring instrument used to observe a physical or environmental property.';
  if (normalizedName.includes('mixer') || normalizedName.includes('shaker')) return 'A laboratory device used to mix or agitate samples under controlled conditions.';
  if (normalizedName.includes('fumehood')) return 'A ventilated laboratory enclosure that helps contain and remove hazardous vapors.';
  if (normalizedName.includes('glassware')) return 'Laboratory vessels used to contain, measure, mix, or process samples.';
  if (normalizedName.includes('area')) return 'A designated workspace for carrying out the activities associated with this laboratory or center.';
  return 'An exhibit or equipment label recorded in the local center dataset. TAYLOR can provide a more specific explanation when a connection is available.';
}

export function getVerifiedExhibitInformation(center, recognitionLabel, displayName) {
  const normalizedCenter = String(center || '').trim().toUpperCase();
  const candidates = [recognitionLabel, displayName].filter(Boolean).map(normalize);
  return exhibitInformation.exhibits.find((item) => (
    item.center === normalizedCenter &&
    item.verified === true &&
    (candidates.includes(normalize(item.recognitionLabel)) ||
      candidates.includes(normalize(item.displayName)))
  )) || null;
}

export function getExhibitInformationRecord(center, recognitionLabel, displayName) {
  const normalizedCenter = String(center || '').trim().toUpperCase();
  const candidates = [recognitionLabel, displayName].filter(Boolean).map(normalize);
  return exhibitInformation.exhibits.find((item) => (
    item.center === normalizedCenter &&
    (candidates.includes(normalize(item.recognitionLabel)) || candidates.includes(normalize(item.displayName)))
  )) || null;
}

export function getOfflineExhibitInformation(center, recognitionLabel, displayName) {
  const normalizedCenter = String(center || '').trim().toUpperCase();
  const label = String(displayName || recognitionLabel || '').trim();
  if (!label) return null;
  return {
    center: normalizedCenter,
    recognitionLabel: recognitionLabel || label,
    displayName: label,
    whatIsIt: offlineMeaning(label),
    purpose: `It is included in the ${normalizedCenter || 'local'} exhibit dataset for visitor learning and demonstration.`,
    sources: ['Local exhibit dataset'],
    verified: false,
    offline: true,
  };
}

export default exhibitInformation;
