import fs from "fs";
async function test() {
  const formData = new FormData();
  formData.append("files", new Blob([Buffer.from("Hello world, this is a test PDF", "utf-8")]), "test.txt");
  try {
    const res = await fetch("http://38.247.148.215:5001/v1/convert/file", {
      method: "POST",
      body: formData
    });
    console.log(res.status);
    console.log(await res.text());
  } catch(e) {
    console.error(e);
  }
}
test();
