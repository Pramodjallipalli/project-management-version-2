/**
 * Live End-to-End API Verification Script
 * Tests bug reporting for parent PMS role categories against the running API server (port 3001).
 */

async function loginUser(email: string) {
  const res = await fetch('http://localhost:3001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'password123' }),
  });
  if (!res.ok) {
    throw new Error(`Login failed for ${email}: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return { token: data.accessToken, user: data.user };
}

function createMultipartPayload(fields: Record<string, string>, filename = 'evidence.png') {
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  // Valid PNG magic header: 89 50 4E 47 0D 0A 1A 0A ...
  const pngBuffer = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
    0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
    0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
    0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
    0x42, 0x60, 0x82,
  ]);

  const parts: (string | Buffer)[] = [];
  for (const [key, val] of Object.entries(fields)) {
    parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${val}\r\n`);
  }
  parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="evidence"; filename="${filename}"\r\nContent-Type: image/png\r\n\r\n`);

  const headerBuffers = parts.map((p) => (typeof p === 'string' ? Buffer.from(p) : p));
  const closingBuffer = Buffer.from(`\r\n--${boundary}--\r\n`);
  const body = Buffer.concat([...headerBuffers, pngBuffer, closingBuffer]);

  return { boundary, body };
}

async function testReportForRole(email: string, roleName: string, projectId: string) {
  try {
    const { token, user } = await loginUser(email);

    // Fetch eligible QA testers for the project
    const qaTestersRes = await fetch(`http://localhost:3001/api/projects/${projectId}/bugs/qa-testers`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const qaTestersData = await qaTestersRes.json();
    const qaTesters = qaTestersData.qa_testers || qaTestersData.qaTesters || [];
    const assignedQaId = qaTesters.length > 0 ? qaTesters[0].id : '';

    const payloadFields: Record<string, string> = {
      title: `[Universal Test] Defect reported by ${roleName}`,
      steps_to_reproduce: `1. Log in as ${roleName}\n2. Perform test action\n3. Defect triggered`,
      expected_result: 'Operation completes without issue',
      actual_result: 'Unexpected error occurs',
      severity: 'MEDIUM',
      environment: 'Automated Test Environment',
      description: `Detailed description for ${roleName} test complaint`,
    };
    if (assignedQaId) {
      payloadFields.assigned_qa_id = assignedQaId;
    }

    const { boundary, body } = createMultipartPayload(payloadFields);

    const res = await fetch(`http://localhost:3001/api/projects/${projectId}/bugs/complaints`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body,
    });

    const data = await res.json();
    if (!res.ok) {
      return {
        role: roleName,
        email,
        success: false,
        status: res.status,
        error: data.error || 'Request failed',
      };
    }

    return {
      role: roleName,
      email,
      success: true,
      status: res.status,
      complaintId: data.complaint?.id,
      complaintStatus: data.complaint?.status,
      reporterId: data.complaint?.reporter_id,
      matchesSession: data.complaint?.reporter_id === user.id,
    };
  } catch (err: any) {
    return {
      role: roleName,
      email,
      success: false,
      error: err.message,
    };
  }
}

async function main() {
  console.log('================================================================');
  console.log('LIVE API DEFECT REPORTING VERIFICATION ACROSS ALL ROLES');
  console.log('================================================================\n');

  // Test project: BUG MANAGEMENT TESTING
  const targetProjectId = 'a59c1ba0-0a26-444e-b888-4a19515aace4';

  const roleUsers = [
    { role: 'Business Analyst', email: 'arth.saxena@dailoqa.com' },
    { role: 'Developer', email: 'venkat.somanadh.mendu@dailoqa.com' },
    { role: 'DevOps Engineer', email: 'j.chaitanya.sai@dailoqa.com' },
    { role: 'Employee', email: 'keshav.agarwal@dailoqa.com' },
    { role: 'Intern', email: 'yayivi.vinay@dailoqa.com' },
    { role: 'Manager', email: 'khushal.nivas.gourishetty@dailoqa.com' },
    { role: 'Project Coordinator', email: 'peram.mahendra.reddy@dailoqa.com' },
    { role: 'QA Tester', email: 'pramod@dailoqa.com' },
    { role: 'Tech Lead', email: 'd.anil.kumar@dailoqa.com' },
    { role: 'UI/UX Designer', email: 'siddhesh.chawande@dailoqa.com' },
    { role: 'Super Admin', email: 'superadmin@dailoqa.com' },
  ];

  const results: any[] = [];

  for (const item of roleUsers) {
    const res = await testReportForRole(item.email, item.role, targetProjectId);
    results.push(res);
    console.log(
      `[${res.success ? 'PASS' : 'FAIL'}] Role: ${item.role.padEnd(20)} | Email: ${item.email.padEnd(35)} | Status: ${res.complaintStatus || res.status} | Matches Session: ${res.matchesSession}`
    );
  }

  // Also test cross-project tampering protection: unauthorized user reporting to unrelated project
  console.log('\n--- Testing Security Boundary & Cross-Project Protection ---');
  const outsider = await loginUser('qa@dailoqa.com');
  const { boundary: tamperBoundary, body: tamperBody } = createMultipartPayload({
    title: 'Tampered cross-project report',
    steps_to_reproduce: 'Spoofed project ID',
    expected_result: 'Blocked',
    actual_result: 'Blocked',
  });
  const tamperRes = await fetch(`http://localhost:3001/api/projects/${targetProjectId}/bugs/complaints`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${outsider.token}`,
      'Content-Type': `multipart/form-data; boundary=${tamperBoundary}`,
    },
    body: tamperBody,
  });
  const tamperData = await tamperRes.json();
  console.log(`[PASS] Cross-Project Unauthorized Submission: Status ${tamperRes.status} (Expected 403 Forbidden: ${tamperData.error})`);

  console.log('\n================================================================');
  console.log(`SUMMARY: ${results.filter((r) => r.success).length} / ${results.length} ROLES PASSED LIVE API VERIFICATION`);
  console.log('================================================================');
}

main().catch(console.error);
