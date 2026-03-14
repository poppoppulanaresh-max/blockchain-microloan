import React, { useState } from "react";

/* ----------------------------- STYLES ----------------------------- */

const s = {
page:{
fontFamily:"Arial",
background:"#f4f7fb",
minHeight:"100vh",
padding:"30px"
},

card:{
background:"#fff",
padding:"25px",
borderRadius:"10px",
boxShadow:"0 3px 10px rgba(0,0,0,0.1)",
marginBottom:"20px"
},

title:{
fontSize:"26px",
marginBottom:"20px"
},

input:{
width:"100%",
padding:"10px",
marginBottom:"12px",
borderRadius:"6px",
border:"1px solid #ccc"
},

btn:{
padding:"10px 18px",
background:"#2f80ed",
border:"none",
color:"#fff",
borderRadius:"6px",
cursor:"pointer"
},

danger:{
padding:"10px 18px",
background:"#e74c3c",
border:"none",
color:"#fff",
borderRadius:"6px",
cursor:"pointer"
},

grid:{
display:"grid",
gridTemplateColumns:"repeat(3,1fr)",
gap:"20px"
},

stat:{
background:"#fff",
padding:"20px",
borderRadius:"8px",
textAlign:"center",
boxShadow:"0 2px 6px rgba(0,0,0,0.1)"
},

table:{
width:"100%",
borderCollapse:"collapse"
},

th:{
borderBottom:"1px solid #ddd",
padding:"10px",
textAlign:"left"
},

td:{
padding:"10px",
borderBottom:"1px solid #eee"
},

progress:{
height:"10px",
background:"#ddd",
borderRadius:"10px",
overflow:"hidden"
},

progressFill:{
height:"10px",
background:"#2f80ed"
},

log:{
background:"#fff",
padding:"10px",
marginBottom:"10px",
borderRadius:"6px"
}
};

/* ----------------------------- REGISTER ----------------------------- */

export function Register(){

const [name,setName]=useState("");
const [email,setEmail]=useState("");
const [password,setPassword]=useState("");

function submit(e){
e.preventDefault();
alert("Registered successfully");
}

return(
<div style={s.page}>
<div style={s.card}>

<h2 style={s.title}>Create Account</h2>

<form onSubmit={submit}>

<input
style={s.input}
placeholder="Name"
value={name}
onChange={e=>setName(e.target.value)}
/>

<input
style={s.input}
placeholder="Email"
value={email}
onChange={e=>setEmail(e.target.value)}
/>

<input
style={s.input}
type="password"
placeholder="Password"
value={password}
onChange={e=>setPassword(e.target.value)}
/>

<button style={s.btn}>Register</button>

</form>

</div>
</div>
);
}

/* ----------------------------- LOGIN ----------------------------- */

export function Login(){

const [email,setEmail]=useState("");
const [password,setPassword]=useState("");

function submit(e){
e.preventDefault();
alert("Login successful");
}

return(
<div style={s.page}>
<div style={s.card}>

<h2 style={s.title}>Login</h2>

<form onSubmit={submit}>

<input
style={s.input}
placeholder="Email"
value={email}
onChange={e=>setEmail(e.target.value)}
/>

<input
style={s.input}
type="password"
placeholder="Password"
value={password}
onChange={e=>setPassword(e.target.value)}
/>

<button style={s.btn}>Login</button>

</form>

</div>
</div>
);
}

/* ----------------------------- DASHBOARD ----------------------------- */

export function Dashboard(){

return(
<div style={s.page}>

<h2 style={s.title}>Dashboard</h2>

<div style={s.grid}>

<div style={s.stat}>
<h3>Total Loans</h3>
<p>12</p>
</div>

<div style={s.stat}>
<h3>Approved</h3>
<p>7</p>
</div>

<div style={s.stat}>
<h3>Pending</h3>
<p>3</p>
</div>

</div>

</div>
);
}

/* ----------------------------- KYC ----------------------------- */

export function KYCSubmit(){

const [name,setName]=useState("");
const [aadhaar,setAadhaar]=useState("");

function submit(e){
e.preventDefault();
alert("KYC submitted");
}

return(
<div style={s.page}>

<div style={s.card}>

<h2 style={s.title}>KYC Verification</h2>

<form onSubmit={submit}>

<input
style={s.input}
placeholder="Full Name"
value={name}
onChange={e=>setName(e.target.value)}
/>

<input
style={s.input}
placeholder="Aadhaar Number"
value={aadhaar}
onChange={e=>setAadhaar(e.target.value)}
/>

<button style={s.btn}>Submit KYC</button>

</form>

</div>

</div>
);
}

/* ----------------------------- APPLY LOAN ----------------------------- */

export function ApplyLoan(){

const [amount,setAmount]=useState("");

function submit(e){
e.preventDefault();
alert("Loan request submitted");
}

return(
<div style={s.page}>

<div style={s.card}>

<h2 style={s.title}>Apply for Loan</h2>

<form onSubmit={submit}>

<input
style={s.input}
placeholder="Loan Amount"
value={amount}
onChange={e=>setAmount(e.target.value)}
/>

<button style={s.btn}>Apply</button>

</form>

</div>

</div>
);
}

/* ----------------------------- LENDER REVIEW ----------------------------- */

export function LenderReview(){

return(
<div style={s.page}>

<h2 style={s.title}>Loan Requests</h2>

<table style={s.table}>

<thead>
<tr>
<th style={s.th}>User</th>
<th style={s.th}>Amount</th>
<th style={s.th}>Status</th>
<th style={s.th}>Action</th>
</tr>
</thead>

<tbody>

<tr>
<td style={s.td}>Naresh</td>
<td style={s.td}>500</td>
<td style={s.td}>Pending</td>
<td style={s.td}>
<button style={s.btn}>Approve</button>
</td>
</tr>

</tbody>

</table>

</div>
);
}

/* ----------------------------- LOAN DETAIL ----------------------------- */

export function LoanDetail(){

return(
<div style={s.page}>

<div style={s.card}>

<h2 style={s.title}>Loan Detail</h2>

<p>Loan Amount: 500</p>

<div style={s.progress}>
<div style={{...s.progressFill,width:"40%"}}></div>
</div>

<p>Milestone Progress 40%</p>

</div>

</div>
);
}

/* ----------------------------- ADMIN PANEL ----------------------------- */

export function AdminPanel(){

return(
<div style={s.page}>

<h2 style={s.title}>Admin Panel</h2>

<div style={s.card}>
<p>Total Users: 120</p>
<p>Total Loans: 43</p>
<p>Pending Approvals: 6</p>
</div>

</div>
);
}

/* ----------------------------- AUDIT LOGS ----------------------------- */

export function AuditLogs(){

return(
<div style={s.page}>

<h2 style={s.title}>Audit Logs</h2>

<div style={s.log}>Loan Created — Block 184002</div>
<div style={s.log}>KYC Submitted — Block 184010</div>
<div style={s.log}>Loan Approved — Block 184020</div>

</div>
);
}