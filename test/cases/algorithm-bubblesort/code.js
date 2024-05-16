function bubbleSort(items) {
    const length = items.length
    let noSwaps

    for (let i = length; i > 0; i--) {
        // flag for optimization
        noSwaps = true
        // Number of passes
        for (let j = 0; j < i - 1; j++) {
            // Compare the adjacent positions
            if (items[j] > items[j + 1]) {
                // Swap the numbers
                ;[items[j], items[j + 1]] = [items[j + 1], items[j]]
                noSwaps = false
            }
        }
        if (noSwaps) {
            break
        }
    }

    return items
}

const items = [5, 3, 7, 6, 2, 9]
console.log(bubbleSort(items))
