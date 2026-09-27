// Transport reporter only. Test expectations remain owned by the challenge author.
export default async function* report(events) {
  const cases = [];
  let summary;
  for await (const {type, data} of events) {
    if ((type === 'test:pass' || type === 'test:fail') && data.details?.type !== 'suite') {
      cases.push({name: data.name, nesting: data.nesting,
        status: data.skip ? 'skipped' : data.todo ? 'todo' : data.details?.error?.failureType === 'cancelledByParent' ? 'cancelled' : type === 'test:pass' ? 'passed' : 'failed',
        diagnostic: data.details?.error?.message ?? null});
    }
    if (type === 'test:summary' && !data.file) summary = data;
  }
  yield JSON.stringify({schema_version: 'contradictor.node-challenge.v1', cases,
    summary: summary ? {tests: summary.counts.tests, passed: summary.counts.passed,
      failed: summary.counts.failed, cancelled: summary.counts.cancelled,
      skipped: summary.counts.skipped, todo: summary.counts.todo} : null}) + '\n';
}
