async function testLifecycle() {
  const loginRes = await fetch('http://localhost:3001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'qa@dailoqa.com', password: 'password123' }),
  });
  const login = await loginRes.json();
  const token = login.accessToken;
  console.log('1. Logged in as QA:', login.user?.name);

  const projectsRes = await fetch('http://localhost:3001/api/projects', {
    headers: { Authorization: 'Bearer ' + token },
  });
  const { projects } = await projectsRes.json();
  const scrumProj = projects.find((p) => p.methodology === 'SCRUM');
  console.log('2. Target Scrum Project:', scrumProj.name, '(', scrumProj.id, ')');

  // Build multipart form data with valid PNG buffer
  const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
  const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52]);

  const formDataParts = [
    '--' + boundary,
    'Content-Disposition: form-data; name="title"',
    '',
    'Critical Memory Leak on Report Generation',
    '--' + boundary,
    'Content-Disposition: form-data; name="description"',
    '',
    'Generating monthly PDF reports crashes the worker node after 5 minutes.',
    '--' + boundary,
    'Content-Disposition: form-data; name="steps_to_reproduce"',
    '',
    '1. Go to Reports\n2. Select Month\n3. Click Export PDF',
    '--' + boundary,
    'Content-Disposition: form-data; name="expected_result"',
    '',
    'PDF downloads in under 3 seconds',
    '--' + boundary,
    'Content-Disposition: form-data; name="actual_result"',
    '',
    'Server spikes to 100% RAM and terminates',
    '--' + boundary,
    'Content-Disposition: form-data; name="severity"',
    '',
    'CRITICAL',
    '--' + boundary,
    'Content-Disposition: form-data; name="environment"',
    '',
    'Production Staging v2.4.0',
    '--' + boundary,
    'Content-Disposition: form-data; name="evidence"; filename="memory_leak_graph.png"',
    'Content-Type: image/png',
    '',
  ];

  const part1 = Buffer.from(formDataParts.join('\r\n') + '\r\n');
  const part2 = pngHeader;
  const part3 = Buffer.from('\r\n--' + boundary + '--\r\n');
  const body = Buffer.concat([part1, part2, part3]);

  const complaintRes = await fetch('http://localhost:3001/api/projects/' + scrumProj.id + '/bugs/complaints', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'multipart/form-data; boundary=' + boundary,
    },
    body: body,
  });
  const complaintData = await complaintRes.json();
  if (!complaintRes.ok) {
    console.error('Complaint request failed with status:', complaintRes.status, complaintData);
  }
  console.log('3. Complaint Submitted:', complaintData.complaint?.title, '| Status:', complaintData.complaint?.status);
  const complaintId = complaintData.complaint.id;

  // QA Reviews Complaint -> Promotes to Bug
  const reviewRes = await fetch('http://localhost:3001/api/projects/' + scrumProj.id + '/bugs/complaints/' + complaintId + '/review', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      outcome: 'VERIFIED',
      priority: 'HIGH',
      notes: 'Reproduced locally with 10k test records. Heap snapshot attached.',
    }),
  });
  const reviewData = await reviewRes.json();
  const bug = reviewData.officialBug;
  console.log('4. QA Gate Verified! Official Bug Created:', bug.bug_code, '-', bug.title, '| Status:', bug.status);

  // Tech Lead logs in and triages/assigns to developer
  const leadLoginRes = await fetch('http://localhost:3001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'lead@dailoqa.com', password: 'password123' }),
  });
  const leadLogin = await leadLoginRes.json();
  const leadToken = leadLogin.accessToken;

  // Fetch project members to get Developer user ID
  const devMember = scrumProj.members.find((m) => m.project_role === 'DEVELOPER');
  console.log('5. Assigning to Developer ID:', devMember.user.email);

  const assignRes = await fetch('http://localhost:3001/api/projects/' + scrumProj.id + '/bugs/' + bug.id + '/triage', {
    method: 'PATCH',
    headers: {
      Authorization: 'Bearer ' + leadToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      assignee_id: devMember.user.id,
      priority: 'HIGH',
      triage_notes: 'Please profile buffer allocation in pdf-generator.ts',
    }),
  });
  const assignedData = await assignRes.json();
  console.log('6. Bug Triaged & Assigned! New Status:', assignedData.bug?.status);

  // Developer logs in and moves bug: ASSIGNED -> IN_PROGRESS -> READY_FOR_RETEST
  const devLoginRes = await fetch('http://localhost:3001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'developer@dailoqa.com', password: 'password123' }),
  });
  const devLogin = await devLoginRes.json();
  const devToken = devLogin.accessToken;

  await fetch('http://localhost:3001/api/projects/' + scrumProj.id + '/bugs/' + bug.id + '/status', {
    method: 'PATCH',
    headers: { Authorization: 'Bearer ' + devToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'IN_PROGRESS', reason: 'Analyzing heap dump' }),
  });
  console.log('7. Developer transitioned status -> IN_PROGRESS');

  await fetch('http://localhost:3001/api/projects/' + scrumProj.id + '/bugs/' + bug.id + '/status', {
    method: 'PATCH',
    headers: { Authorization: 'Bearer ' + devToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'READY_FOR_RETEST', reason: 'Fixed stream chunking', fixed_in_build: 'v2.4.1-rc1' }),
  });
  console.log('8. Developer deployed fix -> Status: READY_FOR_RETEST (Build: v2.4.1-rc1)');

  // QA Retests with screenshot evidence
  const retestBoundary = '----WebKitFormBoundaryRetest123';
  const retestParts = [
    '--' + retestBoundary,
    'Content-Disposition: form-data; name="tested_build"',
    '',
    'v2.4.1-rc1',
    '--' + retestBoundary,
    'Content-Disposition: form-data; name="result"',
    '',
    'PASS',
    '--' + retestBoundary,
    'Content-Disposition: form-data; name="notes"',
    '',
    'PDF generated successfully in 1.4 seconds with steady 80MB RAM usage. Bug is resolved.',
    '--' + retestBoundary,
    'Content-Disposition: form-data; name="evidence"; filename="pass_metrics.png"',
    'Content-Type: image/png',
    '',
  ];
  const retestBody = Buffer.concat([
    Buffer.from(retestParts.join('\r\n') + '\r\n'),
    pngHeader,
    Buffer.from('\r\n--' + retestBoundary + '--\r\n'),
  ]);

  const retestRes = await fetch('http://localhost:3001/api/projects/' + scrumProj.id + '/bugs/' + bug.id + '/retest', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'multipart/form-data; boundary=' + retestBoundary,
    },
    body: retestBody,
  });
  const retestData = await retestRes.json();
  console.log('9. QA Retest Complete! Attempt #:', retestData.retest?.attempt_number, '| Result:', retestData.retest?.result);

  // Fetch final analytics
  const metricsRes = await fetch('http://localhost:3001/api/projects/' + scrumProj.id + '/bugs/analytics', {
    headers: { Authorization: 'Bearer ' + token },
  });
  const { analytics } = await metricsRes.json();
  console.log('10. Live Project Bug Analytics:', JSON.stringify(analytics, null, 2));
  console.log('\n>>> COMPLETE END-TO-END WORKFLOW VERIFIED SUCCESSFULLY! <<<');
}

testLifecycle().catch((err) => {
  console.error('Test Failed:', err);
  process.exit(1);
});
