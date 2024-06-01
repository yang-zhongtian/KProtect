const fs = require('fs');
const path = require('path');
const {makeVM} = require('./utils');

function getDirectories(srcPath) {
    return fs.readdirSync(srcPath).map(file => {
        return path.join(srcPath, file);
    }).filter(file => {
        return fs.statSync(file).isDirectory();
    });
}

const caseDirs = getDirectories(path.join(__dirname, 'cases'));
const outputDir = path.join(__dirname, 'testing');

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
}

caseDirs.forEach(caseDir => {
    const codePath = path.join(caseDir, 'code.js');
    const casesPath = path.join(caseDir, 'cases.js');
    const expectPath = path.join(caseDir, 'expect.js');
    const outputPath = path.join(outputDir, path.basename(caseDir) + '.js');

    if (fs.existsSync(codePath) && fs.existsSync(expectPath)) {
        const cases = require(casesPath);
        const expected = require(expectPath);

        test(`Test case: ${path.basename(caseDir)}`, () => {
            const fn = makeVM(codePath, outputPath);
            const result = cases.map(v => fn(...v));
            expect(result).toEqual(expected);
            fs.unlinkSync(outputPath);
        });
    }
});
