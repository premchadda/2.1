const res = await fetch("http://localhost:5001/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-Client-App": "admin-web" },
  body: JSON.stringify({ email: "admin@trstprep.com", password: "Admin@123" }),
});
console.log("login status", res.status);
const data = await res.json();
console.log("login data", JSON.stringify(data).slice(0, 500));
const cookies = res.headers.get("set-cookie");
console.log("cookies", cookies?.slice(0, 200));
const token = data.data?.token || data.token;
console.log("token", token?.slice(0, 20));
if (token) {
  const r2 = await fetch("http://localhost:5001/api/admin/subjects", {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Client-App": "admin-web",
      "Content-Type": "application/json",
    },
  });
  console.log("subjects status", r2.status);
  console.log("subjects body", (await r2.text()).slice(0, 500));
  const r3 = await fetch("http://localhost:5001/api/admin/current-affairs", {
    headers: { Authorization: `Bearer ${token}`, "X-Client-App": "admin-web" },
  });
  console.log("current-affairs status", r3.status);
  console.log("current-affairs body", (await r3.text()).slice(0, 500));
  const r4 = await fetch("http://localhost:5001/api/admin/subjects-list", {
    headers: { Authorization: `Bearer ${token}`, "X-Client-App": "admin-web" },
  });
  console.log("subjects-list status", r4.status);
  console.log("subjects-list body", (await r4.text()).slice(0, 800));
}
