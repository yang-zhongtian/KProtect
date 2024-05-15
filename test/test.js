const fs = require('fs');
const path = require('path');
const {runCase} = require('./utils');

function getDirectories(srcPath) {
    return fs.readdirSync(srcPath).map(file => {
        return path.join(srcPath, file);
    }).filter(file => {
        return fs.statSync(file).isDirectory();
    });
}

const caseDirs = getDirectories(path.join(__dirname, 'cases'));

caseDirs.forEach(caseDir => {
    const codePath = path.join(caseDir, 'code.js');
    const expectPath = path.join(caseDir, 'expect.js');

    if (fs.existsSync(codePath) && fs.existsSync(expectPath)) {
        const code = fs.readFileSync(codePath, 'utf8');
        const expected = require(expectPath);

        test(`Test case: ${path.basename(caseDir)}`, () => {
            const logSpy = jest
                .spyOn(global.console, 'log', undefined)
                .mockImplementation(() => {
                })
            runCase(code);
            expected.forEach((v) => {
                expect(logSpy).toHaveBeenCalledWith(v);
            })
            logSpy.mockRestore();
        });
    }
});
