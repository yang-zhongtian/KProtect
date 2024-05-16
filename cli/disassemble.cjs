const {Command} = require('commander');
const {readFileSync} = require('fs');
const {disassemble} = require('@kprotect/debugger');
const path = require("path");

const program = new Command();
program
    .option('-s, --source <file>', 'Source file path')
    .parse(process.argv);

const {source} = program.opts();

if (!source) {
    console.error('Error: Both source and output file paths are required.');
    process.exit(1);
}

const cwd = process.cwd();
const absoluteSource = path.resolve(cwd, source);

const src = readFileSync(absoluteSource).toString();
const bundle = JSON.parse(src);
const result = disassemble(bundle.bytecode, bundle.strings);
console.log(result);
