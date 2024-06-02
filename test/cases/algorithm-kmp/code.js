function buildPartialMatchTable(pattern) {
    let partialMatchTable = new Array(pattern.length);
    let j = 0;
    partialMatchTable[0] = 0;
    for (let i = 1; i < pattern.length; i++) {
        while (j > 0 && pattern[i] !== pattern[j]) {
            j = partialMatchTable[j - 1];
        }
        if (pattern[i] === pattern[j]) {
            j++;
        }
        partialMatchTable[i] = j;
    }
    return partialMatchTable;
}

function KMP(text, pattern) {
    const res = []

    let m = pattern.length;
    let n = text.length;
    let i = 0;
    let j = 0;
    let partialMatchTable = buildPartialMatchTable(pattern);

    while (i < n) {
        if (pattern[j] === text[i]) {
            i++;
            j++;
        }
        if (j === m) {
            res.push(i - j);
            j = partialMatchTable[j - 1];
        } else if (i < n && pattern[j] !== text[i]) {
            if (j !== 0) {
                j = partialMatchTable[j - 1];
            } else {
                i++;
            }
        }
    }
    return res;
}

module.exports = KMP;
