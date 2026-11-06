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

const OFFLINE_EXHIBIT_MEANINGS_TL = Object.freeze({
  '3d printer': 'Isang makinang bumubuo ng pisikal na bagay nang paisa-isang layer mula sa digital na disenyo.',
  'collaborative robot': 'Isang robot na idinisenyo upang ligtas na makipagtulungan sa mga tao sa magkakasamang gawain.',
  fdas: 'Isang fire detection and alarm system na kumikilala ng sunog at nagbibigay ng babala sa mga tao sa gusali.',
  'industrial robot': 'Isang programmable na robot para sa paulit-ulit na gawain tulad ng paghawak, pagbuo, o pagproseso.',
  'pick place machine': 'Isang awtomatikong makina na kumukuha ng mga bahagi at inilalagay ang mga ito nang tumpak sa bagong posisyon.',
  'robotic arm': 'Isang programmable na mekanikal na braso na gumagalaw ng mga kasangkapan o bagay sa kontroladong mga posisyon.',
  'smart systems': 'Mga magkakaugnay na teknolohiyang gumagamit ng sensor, software, at control system upang magmonitor ng kondisyon at mag-automate ng mga gawain.',
  'speech home automation': 'Isang sistemang gumagamit ng mga utos sa pagsasalita upang kontrolin ang mga nakakonektang device at function sa bahay.',
  'digital embroidery machine': 'Isang computer-controlled na makina na nagtatahi ng mga programadong disenyo sa tela.',
  '3d outputs': 'Mga pisikal na prototype o bahaging ginawa mula sa digital na disenyo gamit ang fabrication equipment.',
  bcn3d: 'Isang 3D printer platform para gumawa ng mga pisikal na bahagi mula sa digital na modelo, kabilang ang mga prototype at functional na bahagi.',
  'crealty ender 3d printer': 'Isang desktop 3D printer na gumagawa ng mga pisikal na bahagi nang paisa-isang layer mula sa digital na modelo.',
  'leapfrog bolt pro': 'Isang professional 3D printer na ginagamit upang gawing pisikal na prototype at bahagi ang mga digital na disenyo.',
  stratasys: 'Isang professional additive-manufacturing system para gumawa ng tumpak na pisikal na prototype at bahagi.',
  vaquform: 'Isang desktop thermoforming machine na humuhubog ng pinainit na plastic sheet sa ibabaw ng molde.',
  spectrophotometer: 'Isang laboratory instrument na sumusukat kung gaano karaming liwanag ang sinisipsip o ipinapadaan ng sample.',
  microscope: 'Isang optical instrument para makita ang mga detalyeng napakaliit upang makita nang malinaw ng mata.',
  incubator: 'Isang kontroladong silid na nagpapanatili ng mga kondisyon tulad ng temperatura para sa mga sample o kultura.',
  centrifuge: 'Isang makinang laboratoryo na naghihiwalay ng mga materyal sa pamamagitan ng mabilis na pag-ikot ng mga sample.',
  'analytical balance': 'Isang precision laboratory balance na tumpak na sumusukat ng napakaliit na masa.',
  'benchtop multi parameter meter': 'Isang benchtop instrument na sumusukat ng ilang katangian ng sample, tulad ng pH, conductivity, o dissolved solids.',
  'biobase vortex mixer': 'Isang laboratory mixer na mabilis na nagpapaikot ng mga tubo upang mapaghalo ang laman nito.',
  'chemical testing area': 'Isang itinalagang lugar ng laboratoryo para sa pagsusuri at pag-aanalisa ng mga chemical sample.',
  'digital dry bath incubator': 'Isang temperature-controlled block heater na nagpapainit ng mga tubo o maliit na lalagyan nang hindi gumagamit ng tubig.',
  'ducted fumehood': 'Isang maaliwalas na enclosure na kumokontrol at naglalabas ng mapanganib na singaw palabas ng laboratoryo.',
  gravimetrics: 'Isang paraan ng pagsukat na tumutukoy sa dami batay sa masa ng sample o namuong materyal.',
  'hot plate with stirrer': 'Isang laboratory hot plate na nagpapainit ng sample habang hinahalo ito ng magnetic stir bar.',
  img: 'Isang source-image label mula sa CAESAR training dataset; hindi ito tumutukoy sa partikular na laboratory instrument.',
  'laboratory glassware': 'Mga lalagyan sa laboratoryo para maglaman, magsukat, maghalo, o magproseso ng mga sample.',
  'microprocessor centrifuge': 'Isang programmable centrifuge na naghihiwalay ng mga sample sa kontroladong bilis at oras ng pag-ikot.',
  nichipet: 'Isang adjustable micropipette para tumpak na maglipat ng maliliit at sinusukat na dami ng likido.',
  'nichipet ex ii': 'Isang adjustable micropipette para tumpak na maglipat ng maliliit at sinusukat na dami ng likido.',
  'nichipet ex ii and biobase vortex mixer': 'Isang laboratory station na pinagsasama ang micropipette para sa paglipat ng likido at vortex mixer para sa mabilis na paghahalo ng sample.',
  'preparation area': 'Isang itinalagang lugar ng trabaho kung saan inihahanda ang mga sample, materyal, o kagamitan para sa laboratory procedure.',
  'shaker incubator': 'Isang temperature-controlled chamber na marahang nag-aalog ng mga sample habang ini-incubate ang mga ito.',
  'velocity 18r pro centrifuge': 'Isang high-speed refrigerated centrifuge na naghihiwalay ng laboratory sample habang kinokontrol ang temperatura.',
  'charcoal oven machine': 'Isang heating machine na gumagamit ng uling bilang panggatong para magluto o magproseso ng materyal sa init.',
  'festo solar wind training system': 'Isang training system na pang-edukasyon para ipakita ang mga konsepto ng renewable energy gamit ang solar at wind power.',
  'fluke 2042 cable tracer': 'Isang diagnostic instrument para hanapin at sundan ang mga electrical cable, kabilang ang mga nakatago sa likod ng surface.',
  'fluke 355 clamp meter': 'Isang clamp meter para sukatin ang electrical current nang hindi tinatanggal ang conductor, pati ang iba pang electrical value.',
  'fluke 922 air flow meter': 'Isang instrument na sumusukat ng bilis at dami ng daloy ng hangin at pressure sa ventilation system.',
  'fluke 930 non contact tachometer': 'Isang non-contact instrument na sumusukat sa bilis ng pag-ikot ng shaft o iba pang gumagalaw na bagay.',
  'ip display area': 'Isang itinalagang display area para magpakita ng impormasyon, instruction, o project content sa mga bisita.',
  'quadruple suction single discharge cooking oil transfer device': 'Isang food-processing device na gumagamit ng maraming suction point at isang discharge path para maglipat ng cooking oil.',
  'root crop slicing machine': 'Isang makina na naghihiwa ng root crop sa pantay-pantay na hiwa o iba pang pare-parehong hugis.',
  'testo 420 volume flow hood': 'Isang measurement hood para sukatin ang volume flow ng hangin sa mga ventilation outlet tulad ng diffuser at grille.',
  'testo 440 air velocity iaq': 'Isang modular measuring instrument para suriin ang bilis ng hangin at indoor air quality.',
  'unmanned aerial system': 'Isang aircraft system na pinapatakbo nang walang taong sakay, karaniwang ginagamit sa pagmamasid, pagmamapa, o pananaliksik.',
});

const OFFLINE_EXHIBIT_MEANINGS_ZH = Object.freeze({
  '3d printer': '一种根据数字设计逐层制造实体物体的机器。',
  'collaborative robot': '一种专为与人安全协同完成任务而设计的机器人。',
  fdas: '一种用于识别火灾情况并向建筑内人员发出警报的火灾探测和报警系统。',
  'industrial robot': '一种可编程机器人，用于搬运、装配或加工等重复性任务。',
  'pick place machine': '一种自动抓取零件并将其准确放置到新位置的机器。',
  'robotic arm': '一种可编程机械臂，可将工具或物体移动到受控位置。',
  'smart systems': '使用传感器、软件和控制系统监测状况并自动执行任务的互联技术。',
  'speech home automation': '一种使用语音指令控制联网设备和家庭功能的系统。',
  'digital embroidery machine': '一种由计算机控制、可将编程图案缝制到织物上的机器。',
  '3d outputs': '使用制造设备根据数字设计制作的实体原型或零件。',
  bcn3d: '一种根据数字模型制造实体零件的平台，包括原型和功能性部件。',
  'crealty ender 3d printer': '一种根据数字模型逐层制造实体零件的桌面 3D 打印机。',
  'leapfrog bolt pro': '一种用于将数字设计制成实体原型和零件的专业 3D 打印机。',
  stratasys: '一种用于制造精确实体原型和部件的专业增材制造系统。',
  vaquform: '一种将加热后的塑料片材覆盖在模具上并成形的桌面热成型机。',
  spectrophotometer: '一种测量样品吸收或透过多少光线的实验室仪器。',
  microscope: '一种用于观察肉眼无法清晰看见的微小细节的光学仪器。',
  incubator: '一种用于为样品或培养物保持温度等条件的受控箱体。',
  centrifuge: '一种通过高速旋转样品来分离材料的实验室设备。',
  'analytical balance': '一种用于精确测量极小质量的实验室精密天平。',
  'benchtop multi parameter meter': '一种测量样品多项性质的台式仪器，例如 pH、电导率或溶解固体含量。',
  'biobase vortex mixer': '一种通过快速振荡试管来混合其内容物的实验室混合器。',
  'chemical testing area': '用于测试和分析化学样品的指定实验室工作区域。',
  'digital dry bath incubator': '一种无需用水即可加热试管或小容器的温控块式加热器。',
  'ducted fumehood': '一种通风罩，用于收集有害蒸气并将其排出实验室。',
  gravimetrics: '一种根据样品或沉淀物的质量确定数量的实验室测量方法。',
  'hot plate with stirrer': '一种在使用磁力搅拌子混合样品的同时加热样品的实验室加热板。',
  img: 'CAESAR 训练数据集中的源图像标签；它不代表特定的实验室仪器。',
  'laboratory glassware': '用于盛放、测量、混合或处理样品的实验室器皿。',
  'microprocessor centrifuge': '一种可编程离心机，可按受控的速度和时间旋转分离样品。',
  nichipet: '一种可调节移液器，用于准确转移少量、经过测量的液体。',
  'nichipet ex ii': '一种可调节移液器，用于准确转移少量、经过测量的液体。',
  'nichipet ex ii and biobase vortex mixer': '一个结合了液体转移移液器和快速混合样品的涡旋混合器的实验室工作站。',
  'preparation area': '用于为实验流程准备样品、材料或设备的指定工作区域。',
  'shaker incubator': '一种在培养样品的同时轻柔摇动样品的控温箱。',
  'velocity 18r pro centrifuge': '一种高速冷冻离心机，可在控制温度的同时分离实验室样品。',
  'charcoal oven machine': '一种使用木炭作为燃料来烹饪或进行热处理的加热设备。',
  'festo solar wind training system': '一种用于演示太阳能和风能等可再生能源概念的教育培训系统。',
  'fluke 2042 cable tracer': '一种用于定位和追踪电缆的诊断仪器，包括隐藏在表面后面的电缆。',
  'fluke 355 clamp meter': '一种无需断开导体即可测量电流及其他电气参数的钳形表。',
  'fluke 922 air flow meter': '一种用于测量通风系统中空气速度、体积流量和压力的仪器。',
  'fluke 930 non contact tachometer': '一种无需接触即可测量旋转轴或其他物体转速的仪器。',
  'ip display area': '用于向访客展示信息、说明或项目内容的指定展示区域。',
  'quadruple suction single discharge cooking oil transfer device': '一种使用多个吸入口和一条排出路径输送食用油的食品加工设备。',
  'root crop slicing machine': '一种将根茎类作物切成薄片或其他均匀形状的机器。',
  'testo 420 volume flow hood': '一种用于测量扩散器和格栅等通风出口空气体积流量的测量罩。',
  'testo 440 air velocity iaq': '一种用于评估空气速度和室内空气质量的模块化测量仪器。',
  'unmanned aerial system': '一种无人驾驶航空系统，通常用于观察、测绘或研究。',
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
  const localizedMeanings = language === 'tl' ? OFFLINE_EXHIBIT_MEANINGS_TL : language === 'zh' ? OFFLINE_EXHIBIT_MEANINGS_ZH : OFFLINE_EXHIBIT_MEANINGS;
  if (localizedMeanings[normalizedName]) return localizedMeanings[normalizedName];
  const text = OFFLINE_LANGUAGE_TEXT[language] || OFFLINE_LANGUAGE_TEXT.en;
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
