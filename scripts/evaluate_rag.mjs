import dotenv from 'dotenv';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
dotenv.config({ path: path.join(root, '.env') });
const datasetPath = path.resolve(process.env.RAG_EVAL_DATASET || 'Documentation/evaluation/rag_test_questions.json');
const outputDirectory = path.resolve(process.env.RAG_EVAL_OUTPUT_DIR || 'Documentation/evaluation');
const resultsPath = path.join(outputDirectory, 'rag_evaluation_results.csv');
const summaryPath = path.join(outputDirectory, 'rag_evaluation_summary.json');
const reportPath = path.join(outputDirectory, 'chapter4_rag_evaluation.md');

function arg(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
}

function hasFlag(name) { return process.argv.includes(`--${name}`); }
function csv(value) { return `"${String(value ?? '').replaceAll('"', '""')}"`; }
function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = (sorted.length - 1) * p;
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (rank - lower);
}
function normalize(value) { return String(value || '').toLowerCase(); }
function automatedClass(item, reply, httpStatus) {
  if (httpStatus !== 200 || !reply) return 'Unsuccessful';
  const text = normalize(reply);
  const terms = item.requiredFacts || [];
  const matched = terms.filter((term) => text.includes(normalize(term))).length;
  const abstention = /not provide|no (verified )?records|do not have|cannot provide|not available|insufficient|don't have|does not provide/i.test(reply);
  if (item.answerAvailability === 'unavailable') return abstention ? 'Appropriate Abstention' : 'Incorrect';
  if (matched === terms.length) return 'Correct';
  if (matched > 0 || abstention) return 'Partially Correct';
  return 'Incorrect';
}
function retrievalMetadata(body) {
  const results = Array.isArray(body?.retrievedDocuments) ? body.retrievedDocuments : Array.isArray(body?.retrievalResults) ? body.retrievalResults : [];
  const ids = results.map((item) => item?.id).filter(Boolean);
  const scores = results.map((item) => item?.score).filter((score) => Number.isFinite(Number(score))).map(Number);
  const legacyIds = Array.isArray(body?.retrievedIds) ? body.retrievedIds : [];
  return {
    mode: body?.retrievalMode || 'unreported',
    documentIds: ids.length ? ids : legacyIds,
    relevanceScores: scores,
    evidenceAvailable: Boolean(ids.length || legacyIds.length),
  };
}
function classifyError(error) {
  if (error.name === 'AbortError') return 'timeout';
  if (error.cause?.code === 'ECONNREFUSED') return 'connection-refused';
  return error.message || 'request-error';
}
function buildMessages(item) { return item.messages || [{ role: 'user', content: item.question }]; }
function emptyCsv() {
  return 'questionId,center,question,answerAvailability,reply,automatedScore,researcherScore,researcherVerified,retrievalMode,retrievedDocumentIds,relevanceScores,retrievalEvidenceAvailable,retrievalContainsRequiredFacts,responseTimeMs,httpStatus,errorType\n';
}
async function writeOutputs(rows, metadata, status = 'completed') {
  const headers = ['questionId','center','question','answerAvailability','reply','automatedScore','researcherScore','researcherVerified','retrievalMode','retrievedDocumentIds','relevanceScores','retrievalEvidenceAvailable','retrievalContainsRequiredFacts','responseTimeMs','httpStatus','errorType'];
  const csvText = [headers.join(','), ...rows.map((row) => headers.map((header) => csv(row[header])).join(','))].join('\n') + '\n';
  const counts = Object.fromEntries(['Correct','Partially Correct','Incorrect','Appropriate Abstention','Unsuccessful'].map((key) => [key, rows.filter((row) => row.automatedScore === key).length]));
  const timed = rows.map((row) => row.responseTimeMs).filter((value) => Number.isFinite(value));
  const retrievalRows = rows.filter((row) => row.retrievalContainsRequiredFacts !== null);
  const summary = {
    status,
    generatedAt: new Date().toISOString(),
    dataset: path.relative(root, datasetPath),
    endpoint: metadata.endpoint,
    model: metadata.model || 'unreported',
    deploymentVersion: metadata.deploymentVersion || 'unreported',
    retrievalConfiguration: metadata.retrievalConfiguration || null,
    totalQuestions: rows.length,
    automatedPreliminaryCounts: counts,
    researcherVerifiedCounts: null,
    answerAccuracy: null,
    retrievalSuccessRate: retrievalRows.length ? retrievalRows.filter((row) => row.retrievalContainsRequiredFacts === true).length / retrievalRows.length : null,
    retrievalEvaluatedQuestions: retrievalRows.length,
    responseTimeMs: { count: timed.length, mean: timed.length ? timed.reduce((a, b) => a + b, 0) / timed.length : null, median: percentile(timed, 0.5), p95: percentile(timed, 0.95) },
    apiErrors: rows.filter((row) => row.errorType).map((row) => ({ questionId: row.questionId, errorType: row.errorType })),
    centerResults: Object.fromEntries([...new Set(rows.map((row) => row.center))].map((center) => [center, { total: rows.filter((row) => row.center === center).length, automatedPreliminaryCounts: Object.fromEntries(Object.keys(counts).map((key) => [key, rows.filter((row) => row.center === center && row.automatedScore === key).length])) }])),
    researchIntegrity: { researcherApprovalRequired: true, automatedScoresArePreliminary: true, llamaSelfJudgingUsed: false, fabricatedResults: false },
  };
  await fs.mkdir(outputDirectory, { recursive: true });
  await fs.writeFile(resultsPath, csvText, 'utf8');
  await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2) + '\n', 'utf8');
  const report = `# TAYLOR RAG Evaluation\n\n## Status\n\n**${status}**. Automated scores are preliminary and require independent researcher verification.\n\n## Configuration\n\n- Dataset: \`${summary.dataset}\`\n- Endpoint: \`${summary.endpoint}\`\n- Model: \`${summary.model}\`\n- Deployment version: \`${summary.deploymentVersion}\`\n- Retrieval configuration: \`${JSON.stringify(summary.retrievalConfiguration)}\`\n\n## Results\n\n${status === 'completed_preliminary' ? `The evaluator attempted ${summary.totalQuestions} chatbot requests and produced response records. Preliminary automated counts are Correct ${counts.Correct}, Partially Correct ${counts['Partially Correct']}, Incorrect ${counts.Incorrect}, Appropriate Abstention ${counts['Appropriate Abstention']}, and Unsuccessful ${counts.Unsuccessful}. These are not researcher-verified accuracy results.` : 'No chatbot run was attempted. No accuracy percentage is reported.'}\n\n- Retrieval success rate: ${summary.retrievalSuccessRate === null ? 'not available because the endpoint did not expose document-level evidence' : `${(summary.retrievalSuccessRate * 100).toFixed(2)}%`}\n- Mean response time: ${summary.responseTimeMs.mean === null ? 'not available' : `${summary.responseTimeMs.mean.toFixed(2)} ms`}\n- Median response time: ${summary.responseTimeMs.median === null ? 'not available' : `${summary.responseTimeMs.median.toFixed(2)} ms`}\n- 95th percentile response time: ${summary.responseTimeMs.p95 === null ? 'not available' : `${summary.responseTimeMs.p95.toFixed(2)} ms`}\n\n## Review Protocol\n\n1. The researcher reviews and approves every reference answer and source ID in the dataset.\n2. Run this script with \`--approved\` against the intended existing chatbot endpoint.\n3. Independently inspect each reply and fill \`researcherScore\` and \`researcherVerified\` in the CSV.\n4. Calculate verified accuracy only from researcher scores; an unavailable case is correct only when the approved reference answer says the fact is unavailable.\n\nThe evaluator does not use Llama confidence or Llama-generated judgments as evidence of correctness.\n`;
  await fs.writeFile(reportPath, report, 'utf8');
  return summary;
}

const dataset = JSON.parse(await fs.readFile(datasetPath, 'utf8'));
const endpoint = arg('endpoint', process.env.RAG_EVAL_ENDPOINT || `${process.env.VITE_NODEJS_API_URL || 'http://localhost:3033'}/api/chat`);
const approved = dataset.reviewStatus === 'approved' && Boolean(dataset.approval?.reviewer && dataset.approval?.reviewedAt);
if (!hasFlag('approved') || !approved) {
  await writeOutputs([], { endpoint, model: process.env.OPENROUTER_MODEL || 'unreported', deploymentVersion: 'not-run' }, 'awaiting_researcher_approval');
  console.log(JSON.stringify({ status: 'awaiting_researcher_approval', dataset: path.relative(root, datasetPath), message: 'Review and approve the dataset, then rerun with --approved. No chatbot requests were sent.' }, null, 2));
  process.exit(2);
}

const timeoutMs = Number(arg('timeout-ms', process.env.RAG_EVAL_TIMEOUT_MS || 30000));
const rows = [];
let metadata = { endpoint, model: process.env.OPENROUTER_MODEL || 'unreported', deploymentVersion: 'unreported', retrievalConfiguration: null };
for (const item of dataset.questions) {
  const started = performance.now();
  let body = {};
  let httpStatus = null;
  let errorType = '';
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: buildMessages(item), activeEntity: item.activeEntity || '' }), signal: controller.signal });
    clearTimeout(timeout);
    httpStatus = response.status;
    body = await response.json();
    if (body.model) metadata.model = body.model;
    if (body.deploymentVersion) metadata.deploymentVersion = body.deploymentVersion;
    if (body.retrievalConfig) metadata.retrievalConfiguration = body.retrievalConfig;
    if (!response.ok) errorType = body.errorType || `http-${response.status}`;
  } catch (error) { errorType = classifyError(error); }
  const responseTimeMs = performance.now() - started;
  const retrieval = retrievalMetadata(body);
  const requiredIds = item.supportingSourceRecords || [];
  const retrievalContainsRequiredFacts = retrieval.evidenceAvailable ? requiredIds.length === 0 ? retrieval.documentIds.length > 0 : requiredIds.every((id) => retrieval.documentIds.includes(id)) : null;
  rows.push({ questionId: item.id, center: item.center, question: item.question, answerAvailability: item.answerAvailability, reply: body.reply || '', automatedScore: automatedClass(item, body.reply || '', httpStatus), researcherScore: '', researcherVerified: false, retrievalMode: retrieval.mode, retrievedDocumentIds: retrieval.documentIds.join('|'), relevanceScores: retrieval.relevanceScores.join('|'), retrievalEvidenceAvailable: retrieval.evidenceAvailable, retrievalContainsRequiredFacts, responseTimeMs: Number(responseTimeMs.toFixed(2)), httpStatus: httpStatus ?? '', errorType });
}
const summary = await writeOutputs(rows, metadata, 'completed_preliminary');
console.log(JSON.stringify({ status: summary.status, totalQuestions: summary.totalQuestions, outputFiles: [resultsPath, summaryPath, reportPath] }, null, 2));
