function isLastLevelCompletelyFilled(totalNodes) {
  const levels = Math.floor(Math.log2(totalNodes) + 1);

  // Calculate the maximum number of nodes in the last level
  const maxNodesInLastLevel = 2 ** (levels - 1);

  // Calculate the number of nodes in the last level
  const nodesInLastLevel = totalNodes - 2 ** (levels - 1) + 1;

  // Check if the last level is completely filled
  return nodesInLastLevel === maxNodesInLastLevel;
}

function calculateCompleteBinaryTreeLevel(totalNodes, nodeId) {
  const totalLevels = Math.floor(Math.log2(totalNodes));

  // Check if the node ID is within the valid range
  if (nodeId >= 1 && nodeId <= totalNodes) {
    const level = totalLevels - Math.floor(Math.log2(nodeId));
    return level;
  } else {
    return "Node ID is out of range.";
  }
}
async function totalPossibleNodesAtLevel(level) {
  if (level < 0) {
    return 0; // Invalid level, return 0
  }

  return 2 ** level;
}


module.exports = {
  isLastLevelCompletelyFilled,
  calculateCompleteBinaryTreeLevel,
  totalPossibleNodesAtLevel,
};
