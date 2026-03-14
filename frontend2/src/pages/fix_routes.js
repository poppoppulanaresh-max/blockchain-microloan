const fs = require("fs");

const fixes = [
  ['api.post("/kyc/submit"',             'api.post("/api/kyc/submit"'],
  ['api.post("/loans/apply"',            'api.post("/api/loans/apply"'],
  ['api.get("/loans/my")',               'api.get("/api/loans/my")'],
  ['api.get(`/loans/${id}`)',            'api.get(`/api/loans/${id}`)'],
  ['api.post(`/milestones/${id}/submit`','api.post(`/api/milestones/${id}/submit`'],
  ['api.post(`/repayments/${id}/record`','api.post(`/api/repayments/${id}/record`'],
  ['api.get("/loans/pending")',          'api.get("/api/loans/pending")'],
  ['api.post(`/loans/${loan.id}/approve`','api.post(`/api/loans/${loan.id}/approve`'],
  ['api.post(`/loans/${loan.id}/reject`', 'api.post(`/api/loans/${loan.id}/reject`'],
  ['api.get("/admin/dashboard")',        'api.get("/api/admin/dashboard")'],
  ['api.get("/kyc/pending")',            'api.get("/api/kyc/pending")'],
  ['api.post(`/kyc/verify/${userId}`',  'api.post(`/api/kyc/verify/${userId}`'],
  ['api.get("/admin/audit-logs")',       'api.get("/api/admin/audit-logs")'],
];

const filepath = process.argv[2];
if (!filepath) { console.log("Usage: node fix_routes.js AllPages.jsx"); process.exit(1); }

let content = fs.readFileSync(filepath, "utf8");
let count = 0;

for (const [old, fix] of fixes) {
  if (content.includes(old)) {
    content = content.split(old).join(fix);
    console.log("✅ Fixed: " + old);
    count++;
  } else {
    console.log("⚠  Not found: " + old);
  }
}

fs.writeFileSync(filepath, content, "utf8");
console.log("\nDone — " + count + "/" + fixes.length + " fixes applied");
