# Kernel Protect

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
├──────────┼───────────┼───────────────────┤
│ [ Dict ] │lookUpTable│   index for JMP   │
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

### Opcode structure

```text
┌────────┬─────────────┬─────────┬─────────┬─────┐
│ opcode │  Main Block │ Block 1 │ Block 2 │ ... │
└────────┴─────────────┴─────────┴─────────┴─────┘
```

> A block is a segment of code, seperated because it is not only executed ordinal but also with some condition.

### VM architecture

#### Global
* stack: runtime data storage
* programCounter: current opcode index
* localVariables: variable storage
* exitToPreviousContext: traceback stack after exiting other blocks

#### Core
```text
                    ┌────────────┬───────────────┬─────┐
  traceback stack:  │ mainExit() │ breakpoint1() │ ... │
                    └────────────┴───────────────┴─────┘
                                     |               ↑
              STORE STRING JMP traceback IF_BLOCK   pop
              ┌──↑───↑───────↑───────↓───↑───────────│──────┐
   opcode:    │ 006 000 001 023 002 ... 001 001 000 037 ... │
              └──────────│───────│───────↑───────────↓──────┘
                       fetch   fetch     └───────┐  EXIT
         ┌─────────┬─────↓───┬───↓──────┬─────┐  │
 string: │ string0 │ string1 │ if_xx:xx │ ... │ jmp
         └─────────┴─────────┴─────│────┴─────┘  └────────┐
                                   │                      │
                                locate    lookUpTable:    │
                                   │    ┌───────────────┐ │
                                   └────→ if_xx:xx => 5 ──┘
                                        ├───────────────┤
                                        │      ...      │
                                        └───────────────┘
```

## Usage

### Install dependency

```shell
yarn
```

### Build VM kernel

```shell
yarn build
```

### Protect JS file

```shell
yarn protect
```

The source file is `protect/src.js`, and the output file is `protect/bundle.json`.

## Author
* Name: Richard Yang(杨中天)
* College: Beijing University of Posts and Telecommunications
* Email: zhongtian.yang@qq.com

## Acknowledgement
* https://github.com/Kechinator/jsvm (ISC)
* https://github.com/estools/escodegen (BSD 2-Clause)

## License

### Kernel Protect

Copyright &copy;2023 Richard Yang(杨中天) <zhongtian.yang@qq.com>.

This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>.