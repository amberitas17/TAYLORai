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
  'ip display area': 'A designated display area for presenting information, instructions, or project content to visitors.',
  'quadruple suction single discharge cooking oil transfer device': 'A food-processing device that uses multiple suction points and one discharge path to transfer cooking oil.',
  'root crop slicing machine': 'A food-processing machine that cuts root crops into slices or other consistent pieces.',
  'testo 420 volume flow hood': 'A measurement hood used to determine air volume flow at ventilation outlets such as diffusers and grilles.',
  'testo 440 air velocity iaq': 'A modular measuring instrument used to assess air velocity and indoor-air-quality conditions.',
  'unmanned aerial system': 'An aircraft system operated without a person onboard, commonly used for observation, mapping, or research.',
});

const OFFLINE_LANGUAGE_TEXT = Object.freeze({
  en: {
    generic: (center) => `It is included in the ${center || 'local'} exhibit dataset for visitor learning and demonstration.`,
    meter: 'A measuring instrument used to observe a physical or environmental property.',
    mixer: 'A laboratory device used to mix or agitate samples under controlled conditions.',
    fumehood: 'A ventilated laboratory enclosure that helps contain and remove hazardous vapors.',
    glassware: 'Laboratory vessels used to contain, measure, mix, or process samples.',
    area: 'A designated workspace for carrying out the activities associated with this laboratory or center.',
    unknown: 'An exhibit or equipment label recorded in the local center dataset. TAYLOR can provide a more specific explanation when a connection is available.',
  },
  tl: {
    generic: (center) => `Kasama ito sa dataset ng mga exhibit ng ${center || 'lokal na sentro'} para sa pagkatuto at demonstrasyon ng mga bisita.`,
    meter: 'Isang instrumento sa pagsukat ng pisikal o pangkapaligirang katangian.',
    mixer: 'Isang kagamitang laboratoryo para maghalo o magpagalaw ng mga sample sa kontroladong paraan.',
    fumehood: 'Isang maaliwalas na enclosure ng laboratoryo na tumutulong maglaman at maglabas ng mapanganib na singaw.',
    glassware: 'Mga lalagyan sa laboratoryo para maglaman, magsukat, maghalo, o magproseso ng mga sample.',
    area: 'Isang itinalagang lugar ng trabaho para sa mga gawain ng laboratoryo o sentrong ito.',
    unknown: 'Isang label ng exhibit o kagamitan na nakatala sa lokal na dataset ng sentro. Makapagbibigay si TAYLOR ng mas tiyak na paliwanag kapag may koneksyon.',
  },
  zh: {
    generic: (center) => `它已列入${center || '本地中心'}的展品数据库，用于访客学习和演示。`,
    meter: '一种用于观察物理或环境属性的测量仪器。',
    mixer: '一种在受控条件下混合或搅拌样品的实验室设备。',
    fumehood: '一种通风实验室设备，用于收集并排出有害蒸气。',
    glassware: '用于盛放、测量、混合或处理样品的实验室器皿。',
    area: '一个用于开展该实验室或中心相关活动的指定工作区域。',
    unknown: '这是本地中心数据库中记录的展品或设备标签。联网后，TAYLOR 可以提供更具体的说明。',
  },
});

function offlineMeaning(displayName = '', language = 'en') {
  const normalizedName = normalize(displayName);
  if (language === 'en' && OFFLINE_EXHIBIT_MEANINGS[normalizedName]) return OFFLINE_EXHIBIT_MEANINGS[normalizedName];
  const text = OFFLINE_LANGUAGE_TEXT[language] || OFFLINE_LANGUAGE_TEXT.en;
  if (normalizedName === 'speech home automation' && language === 'tl') return 'Isang sistema na gumagamit ng mga utos sa pagsasalita upang kontrolin ang mga nakakonektang device at function sa bahay.';
  if (normalizedName === 'speech home automation' && language === 'zh') return '一种使用语音指令控制联网设备和家庭功能的系统。';
  if (normalizedName.includes('meter')) return text.meter;
  if (normalizedName.includes('mixer') || normalizedName.includes('shaker')) return text.mixer;
  if (normalizedName.includes('fumehood')) return text.fumehood;
  if (normalizedName.includes('glassware')) return text.glassware;
  if (normalizedName.includes('area')) return text.area;
  return language === 'en'
    ? text.unknown
    : `${displayName || 'Ang exhibit na ito'}: ${text.unknown}`;
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

export function getOfflineExhibitInformation(center, recognitionLabel, displayName, language = 'en') {
  const normalizedCenter = String(center || '').trim().toUpperCase();
  const label = String(displayName || recognitionLabel || '').trim();
  if (!label) return null;
  return {
    center: normalizedCenter,
    recognitionLabel: recognitionLabel || label,
    displayName: label,
    whatIsIt: offlineMeaning(label, language),
    purpose: (OFFLINE_LANGUAGE_TEXT[language] || OFFLINE_LANGUAGE_TEXT.en).generic(normalizedCenter),
    sources: ['Local exhibit dataset'],
    verified: false,
    offline: true,
  };
}

export default exhibitInformation;
