# Kernel Protect
[![Test](https://github.com/yang-zhongtian/KProtect/actions/workflows/test.yml/badge.svg)](https://github.com/yang-zhongtian/KProtect/actions/workflows/test.yml)

**Kernel Protect** (K-Protect for short), is a stack-based virtual machine written in Typescript. It can compile
**ECMAScript(JavaScript)** files to **opcode**, and execute them using the VM. This project can be used to protect
ECMAScript-written algorithms that are used in front-end webpage to block spiders and secure website API.

This VM is inspired by VMProtect and RISC architecture. It is currently experimental and **SHOULD** not be used in any
production environment.

## Structure

### Bundle file

```text
┌──────────────────────────────────────────┐
│            Bundle file (JSON)            │
├──────────┬───────────┬───────────────────┤
│ [String] │  bytecode │ compressed opcode │
├──────────┼───────────┼───────────────────┤
│ [ List ] │  strings  │ string constants  │
└──────────┴───────────┴───────────────────┘
```

### IL structure

```text
┌──────────────────────────────────────────┐
│  Intermediate Language Structure (Dict)  │
├──────────────────────────────────────────┤
│ [String] key: the name of this block     │
│ [ Dict ] val: the data of this block     │
│  ├── [String] key: 'instructions'        │
│  │ + [ List ] val: instruction list      │
│  │    └── [ Dict ] item: instruction     │
│  │         ├── [String] key: 'opcode'    │
│  │         │ + [Number] val: opcode      │
│  │         └── [String] key: 'args'      │
│  │           + [ List ] val: arguments   │
│  │              └── [ Dict ] item: arg   │
│  │                   ├── key: 'type'     │
│  │                   │ + val: [Number]   │
│  │                   └── key: 'value'    │
│  │                     + val: [ Any ]    │
│  └── [String] key: 'inheritsContext'     │
│    + [ Bool ] val: true, not used        │
└──────────────────────────────────────────┘
```

### VM architecture

#### Global
* vmStack: runtime data storage
* programCounter: current opcode index
* dependencies: external objects

## Usage

### Install dependency

```shell
yarn
```

### Build all libraries

```shell
yarn build
```

### Protect JS file

```shell
yarn protect -s sourcefile.js -o bundle.json
```

## Acknowledgement
* https://github.com/Kechinator/jsvm (ISC)
* https://github.com/babel/babel (MIT)
* https://github.com/estools/escodegen (BSD 2-Clause)

## Contributors
<a href="https://github.com/yang-zhongtian/KProtect/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=yang-zhongtian/KProtect" alt="Avatars"/>
</a>
