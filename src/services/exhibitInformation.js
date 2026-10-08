import exhibitInformation from '../../data/verified-exhibit-information.json';

const normalize = (value = '') => String(value).trim().toLowerCase().replace(/[_-]+/g, ' ');

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

export default exhibitInformation;
