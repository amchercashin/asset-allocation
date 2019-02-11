const prefix = "AL";

async function maybeStore(index, indexData) {
    if (typeof (Storage) !== "undefined") {
        sessionStorage.setItem(addPrefixToIndexForStore(index), JSON.stringify(indexData));
        return true;
    } else {
        return false;
    }

}

async function maybeGetFromStore(index) {
    if (typeof (sessionStorage.getItem(addPrefixToIndexForStore(index))) !== "undefined") {
        return JSON.parse(sessionStorage.getItem(addPrefixToIndexForStore(index)));
    } else {
        return false;
    }
}

function addPrefixToIndexForStore (index, prefix) {
    return  prefix + index;
}