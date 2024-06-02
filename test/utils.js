const {readFileSync} = require('node:fs');
const execSync = require('child_process').execSync;

const makeVM = (codePath, outputPath) => {
    execSync(`npm run protect -- -i ${codePath} -o ${outputPath}`, {cwd: '../'})
    const scriptContent = readFileSync(outputPath, 'utf8').toString();
    eval(scriptContent);
    return VM.start;
}

module.exports = {
    makeVM
}
