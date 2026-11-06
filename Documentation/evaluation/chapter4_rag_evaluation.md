# TAYLOR RAG Evaluation

## Status

**completed_preliminary**. Automated scores are preliminary and require independent researcher verification.

## Configuration

- Dataset: `Documentation\evaluation\rag_test_questions.json`
- Endpoint: `http://localhost:3033/api/chat`
- Model: `meta-llama/llama-3.3-70b-instruct`
- Deployment version: `unreported`
- Retrieval configuration: `null`

## Results

The evaluator attempted 30 chatbot requests and produced response records. Preliminary automated counts are Correct 18, Partially Correct 9, Incorrect 1, Appropriate Abstention 2, and Unsuccessful 0. These are not researcher-verified accuracy results.

- Retrieval success rate: not available because the endpoint did not expose document-level evidence
- Mean response time: 4443.98 ms
- Median response time: 2774.01 ms
- 95th percentile response time: 12777.26 ms

## Review Protocol

1. The researcher reviews and approves every reference answer and source ID in the dataset.
2. Run this script with `--approved` against the intended existing chatbot endpoint.
3. Independently inspect each reply and fill `researcherScore` and `researcherVerified` in the CSV.
4. Calculate verified accuracy only from researcher scores; an unavailable case is correct only when the approved reference answer says the fact is unavailable.

The evaluator does not use Llama confidence or Llama-generated judgments as evidence of correctness.
