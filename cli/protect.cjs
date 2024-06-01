const {Command} = require('commander');
const {readFileSync, writeFileSync} = require('fs');
const {protect} = require('@kprotect/compiler');
const {embed} = require('@kprotect/vm');
const path = require('path');

const program = new Command();
program
    .option('-s, --source <file>', 'Source file path')
    .option('-o, --output <file>', 'Output file path')
    .parse(process.argv);

const {source, output} = program.opts();

if (!source || !output) {
    console.error('Error: Both source and output file paths are required.');
    process.exit(1);
}

const cwd = process.cwd();
const absoluteSource = path.resolve(cwd, source);
const absoluteOutput = path.resolve(cwd, output);

const src = readFileSync(absoluteSource).toString();

const {bytecode, strings} = protect(src);

embed(bytecode, strings).then(embedded => {
    writeFileSync(absoluteOutput, embedded);
})
