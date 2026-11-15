import dx from "@eoussama/dx";



export default dx({
  ignores: ["assets/**"],
}, {
  // Scripts run in GitHub Actions report to the job's log.
  files: [".github/scripts/**"],
  rules: {
    "no-console": "off",
  },
});
