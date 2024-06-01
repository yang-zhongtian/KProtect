function test() {
    var a = [];
    a.push(1 + 2);
    a.push(1 - 2);
    a.push(+1 * 2);
    a.push(1 / 2);
    a.push(1 % 2);
    a.push(2 ** 3);
    a.push(10 + 5);
    a.push(10 - 5);
    a.push(10 * 5);
    a.push(10 / 5);
    a.push(10 % 5);
    a.push(3 ** 2);
    a.push(10 / 0);
    a.push(0 / 10);
    a.push(15 + 3);
    a.push(15 - 3);
    a.push(15 * 3);
    a.push(15 / 3);
    a.push(15 % 3);
    a.push(4 ** 2);
    a.push(-1 + 2);
    a.push(-1 - 2);
    a.push(-1 * 2);
    a.push(-1 / 2);
    a.push(-1 % 2);
    a.push(2 ** 3);
    a.push(10 + -5);
    a.push(10 - -5);
    a.push(10 * -5);
    a.push(10 / -5);
    a.push(10 % -5);
    return a;
}

module.exports = test;
