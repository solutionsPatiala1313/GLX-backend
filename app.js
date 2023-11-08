const express = require("express");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors"); // Import the 'cors' middleware
const cron = require("node-cron");
const {
  isLastLevelCompletelyFilled,
  calculateCompleteBinaryTreeLevel,
  totalPossibleNodesAtLevel,
} = require("./helper/functions");
dotenv.config();
const app = express();
const router = express.Router();
// Enable CORS for all routes
app.use(cors());

const port = process.env.PORT || 3001;

// Body parser middleware
app.use(bodyParser.json());

// MongoDB connection
mongoose.connect(
  process.env.MONGO_URL,
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
);
mongoose.connection.on("connected", () => {
  console.log("Connected to MongoDB");
});
// Define a cron job that runs at 12:00 AM daily
// Timer to Update Daily Profit Amount
cron.schedule("0 0 * * *", async () => {
  // cron.schedule("*/9 * * * * *", async () => {
  try {
    const stakedUsers = await User.find({ initialStakingAmount: { $gt: 0 } });
    for (const user of stakedUsers) {
      if (
        user.UpdatedProfitStakingAmount <
        user.MaxRoi * user.initialStakingAmount
      ) {
        user.UpdatedProfitStakingAmount =
          user.initialStakingAmount * user.dailyRoi +
          user.UpdatedProfitStakingAmount;
        user.dailyProfitAmount = user.initialStakingAmount * user.dailyRoi;

        await user.save();
      }
    }

    console.log("Staking amounts updated successfully.");
  } catch (error) {
    console.error("Error updating staking amounts:", error);
  }
});

// Timer for MaxRoi
cron.schedule("0 0 * * *", async () => {
  // cron.schedule("*/9 * * * * *", async () => {
  try {
    const users = await User.find({});

    for (const user of users) {
      if (user.directIncome >= 3) {
        // Update the MaxRoi in the Stake schema for the corresponding wallet address
        user.MaxRoi = 4;
        await user.save();
        // console.log(`MaxRoi for ${user.walletAddress} updated to 4.`);
      }
    }

    console.log("MaxRoi updated successfully.");
  } catch (error) {
    console.error("Error updating MaxRoi:", error);
  }
});

const userSchema = new mongoose.Schema({
  userId: {
    type: Number,
    default: 1,
  },
  walletAddress: String,
  referralAddress: {
    type: String,
    default: null,
  },
  adminAddress: String,
  levelNumber: {
    type: Number,
    default: 0,
  },
  directIncome: Number,
  LevelIncome: Number,
  totalIncome: Number,
  totalReferrals: {
    type: Number,
    default: 0,
  },
  initialStakingAmount: {
    type: Number,
    default: 0,
  },
  UpdatedProfitStakingAmount: {
    type: Number,
    default: 0,
  },
  dailyRoi: {
    type: Number,
    default: 0,
  },
  dailyProfitAmount: {
    type: Number,
    default: 0,
  },
  MaxRoi: {
    type: Number,
    default: 2,
  },
});

userSchema.pre("save", async function (next) {
  if (!this.isNew) {
    return next();
  }

  const lastUser = await this.constructor.findOne({}, "userId", {
    sort: { userId: -1 },
  });

  if (lastUser) {
    this.userId = lastUser.userId + 1;
  } else {
    this.userId = 1;
  }

  return next();
});
const User = mongoose.model("User", userSchema);

class UserNode {
  constructor(user) {
    this.user = user;
    this.children = [];
  }

  // Add a method to add a child node to this user
  addChild(childNode) {
    this.children.push(childNode);
  }
}
// function buildBinaryTree(data) {
//   const nodes = data.map((userData) => new UserNode(userData));

//   // Assuming that the data is ordered in a way that allows building a complete binary tree
//   for (let i = 0; i < nodes.length / 2; i++) {
//     const leftChildIndex = 2 * i + 1;
//     const rightChildIndex = 2 * i + 2;

//     nodes[i].left = nodes[leftChildIndex];
//     nodes[i].right = nodes[rightChildIndex];
//   }

//   return nodes[0]; // Return the root node
// }

// Function to perform level-order traversal and calculate LevelIncome for a specific user
// Function to calculate LevelIncome for a specific user
function calculateUserLevelIncome(root, targetUserId) {
  if (!root) {
    return 0; // No income for an empty tree
  }

  if (root.user.userId === targetUserId) {
    // If the current node is the user we are looking for, calculate income
    return root.user.dailyProfitAmount * 0.4; // Starting level 0 income
  }

  const leftIncome = calculateUserLevelIncome(root.left, targetUserId);
  const rightIncome = calculateUserLevelIncome(root.right, targetUserId);

  if (leftIncome > 0) {
    // If the left subtree has income, calculate income for the next level
    return leftIncome * 0.15;
  } else if (rightIncome > 0) {
    // If the left subtree has no income but the right has, calculate income for the next level
    return rightIncome * 0.15;
  }

  return 0; // The user is not found in this subtree
}

//function to create decision tree for referrals
// Function to build the binary tree structure
function buildBinaryTree(users, parent, level) {
  if (users.length === 0) return;

  const leftUser = users.shift();
  leftUser.referralAddress = parent.walletAddress;
  leftUser.levelNumber = level;
  leftUser.save();

  if (users.length > 0) {
    const rightUser = users.shift();
    rightUser.referralAddress = parent.walletAddress;
    rightUser.levelNumber = level;
    rightUser.save();

    buildBinaryTree(users, leftUser, level + 1);
    buildBinaryTree(users, rightUser, level + 1);
  }
}
function buildDecisionTree(users) {
  // Create a map to store users by their wallet addresses for quick lookup
  const userMap = new Map();

  // Initialize the root node
  let root = null;

  // Iterate through the users and build the tree
  for (const user of users) {
    const userNode = new UserNode(user);

    if (user.referralAddress) {
      // If the user has a referral address, find the parent node and add the user as a child
      const parentNode = userMap.get(user.referralAddress);
      if (parentNode) {
        parentNode.addChild(userNode);
      } else {
        // If the parent node is not found, this user becomes the root
        root = userNode;
      }
    } else {
      // If there's no referral address, this user becomes the root
      root = userNode;
    }

    // Store the user in the map for quick lookup
    userMap.set(user.walletAddress, userNode);
  }

  return root; // Return the root of the decision tree
}
function printDecisionTree(node, level = 0) {
  if (!node) return;

  console.log("  ".repeat(level) + `User: ${node.user.walletAddress}`);
  for (const child of node.children) {
    printDecisionTree(child, level + 1);
  }
}
// Function to find a user in the decision tree based on wallet address
function findUserInDecisionTree(root, targetWalletAddress) {
  if (!root) {
    return null; // User not found
  }

  if (root.user.walletAddress === targetWalletAddress) {
    return root; // User found
  }

  // Recursively search in the left and right subtrees
  const leftResult = findUserInDecisionTree(
    root.children[0],
    targetWalletAddress
  );
  if (leftResult) {
    return leftResult;
  }

  const rightResult = findUserInDecisionTree(
    root.children[1],
    targetWalletAddress
  );
  return rightResult;
}

// Function to calculate the level income for a user below them in the tree
// Function to calculate the level income for a user below them in the tree and keep track of levels
// function calculateUserLevelIncomeBelow(root, userNode, levelPercentages) {
//   if (!userNode) {
//     return 0; // User not found
//   }

//   // Initialize an object to store level information
//   const levelInfo = {
//     level: 0,
//     totalLevelIncome: 0,
//   };

//   // Iterate over the direct users below the user and calculate the level income
//   const directUsers = userNode.children;

//   for (const directUser of directUsers) {
//     let totalLevelIncomeFinal = 0;
//     // Update the level information for each direct user
//     levelInfo.level++;
//     const directUserLevelInfo = calculateUserLevelIncomeBelow(
//       root,
//       directUser,
//       levelPercentages
//     );

//     // Add the level income from the direct user
//     levelInfo.totalLevelIncome += directUserLevelInfo.totalLevelIncome;

//     totalLevelIncomeFinal = directUserLevelInfo.totalLevelIncome;

//     console.log("levelInfo.totalLevelIncome", levelInfo.totalLevelIncome, totalLevelIncomeFinal);

//     // Reset the level to the original level after processing the direct user
//     // levelInfo.level--;
//   }

//   // Calculate level income for the user node and add it to the total level income
//   if (levelInfo.level < levelPercentages.length) {
//     levelInfo.totalLevelIncome +=
//       (levelPercentages[levelInfo.level] / 100) *
//       userNode.user.initialStakingAmount;
//   }

//   return levelInfo;
// }

const levelPercentages = [
  0, 40, 15, 10, 10, 10, 7, 7, 7, 7, 7, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 3, 3, 3,
  3, 3, 3, 3, 3, 3, 3,
];
let totalLevelIncome = 0;
function CalculateLevelIncomeDownLine(node, level) {
  if (!node) return;

  totalLevelIncome =
    totalLevelIncome +
    node.user.dailyProfitAmount * levelPercentages[level] * 0.01;

  for (const child of node.children) {
    CalculateLevelIncomeDownLine(child, level + 1);
    console.log("child", child, "level", level);
  }
}



function calculateSubtreeStakingAmount(node) {
  if (!node) return 0;

  let total = node.user.initialStakingAmount;

  for (const child of node.children) {
    total += calculateSubtreeStakingAmount(child);
  }

  return total;
}


app.get("/", (req, res) => {
  console.log(process.env.MONGO_URL)
  res.send("Hello, MongoDB and Node.js!");
});

app.post("/register", async (req, res) => {
  const { walletAddress } = req.body;
  console.log("walletAddress", walletAddress);

  // Check if the wallet address already exists in the database
  const existingUser = await User.findOne();

  if (existingUser) {
    return res.status(200).json({
      message: `Admin Already exists with address ${existingUser.adminAddress}`,
    });
  }

  // Create a new user record
  const newUser = new User({
    walletAddress,
    adminAddress: walletAddress,
    directIncome: 0,
    LevelIncome: 0,
    totalIncome: 0,
  });

  try {
    await newUser.save();
    return res.status(201).json({ message: "Admin Registration successful." });
  } catch (error) {
    console.error("Error during user registration:", error);
    return res.status(200).json({ error: "Registration failed." });
  }
});

app.post("/registerByReferral", async (req, res) => {
  const { referralAddress, userAddress } = req.body;

  // Check if the referralAddress is a registered user
  const existingUser = await User.findOne({ walletAddress: userAddress });

  if (existingUser) {
    return res
      .status(200)
      .json({ message: `Wallet address ${userAddress} already registered.` });
  }

  const referrer = await User.findOne({ walletAddress: referralAddress });

  if (!referrer) {
    return res.status(200).json({ message: "Referrer not found." });
  }

  // Update the directIncome of the referrer
  referrer.directIncome += 1;
  // Create a new user record
  referrer.totalReferrals += 1;
  const newUser = new User({
    walletAddress: userAddress,
    referralAddress: referralAddress,
    directIncome: 0,
    LevelIncome: 0,
    totalIncome: 0,
  });

  try {
    await newUser.save();
    await referrer.save();
    return res.status(200).json({
      message: `Registration successful by referral address ${referralAddress}`,
    });
  } catch (error) {
    console.error("Error during direct income update:", error);
    return res.status(500).json({ error: "Update failed." });
  }
});

app.post("/calculateStakingIncome", async (req, res) => {
  const { userAddress } = req.body;
  const existingUser = await User.findOne({ walletAddress: userAddress });

  if (!existingUser) {
    return res.status(200).json({ message: "You are not registered" });
  } else {
    const TotalUser = await User.countDocuments({});

    const netlevel = calculateCompleteBinaryTreeLevel(
      TotalUser,
      existingUser.userId
    );

    const isLastLevelFilled = isLastLevelCompletelyFilled(TotalUser);

    let totalDownLevel = 0;

    if (isLastLevelFilled) {
      totalDownLevel = netlevel;
    } else {
      totalDownLevel = netlevel - 1;
    }

    let totalStakingIncome = 0;
    let count = 0;
    for (let i = 1; i <= totalDownLevel; i++) {
      if (count <= 16) {
        totalStakingIncome =
          0.5 * (await totalPossibleNodesAtLevel(i)) + totalStakingIncome;
        console.log("stepLevelIncome", totalStakingIncome);
        count++;
      }
    }
    console.log("count", count);
    console.log("totalStakingIncome", totalStakingIncome);

    try {
      return res.status(200).json({
        totalStakingIncome: totalStakingIncome,
        TotalDownlevel: totalDownLevel,
      });
    } catch (err) {
      console.error("Failed to calculate Level income", error);
      return res.status(200).json({ error: "Failed level income calculation" });
    }
  }
});

app.post("/Stake", async (req, res) => {
  const { userAddress, stakingAmount } = req.body;
  console.log(userAddress, stakingAmount);

  const registeredUser = await User.findOne({
    walletAddress: userAddress,
  });
  if (registeredUser) {
    console.log(registeredUser);
    // const existingStakedUser = await Stake.findOne({
    //   walletAddress: userAddress,
    // });

    // Initialize dailyRoi with a default value

    if (registeredUser.initialStakingAmount > 0) {
      return res.status(200).json({ message: `You have already staked` });
    }

    let profitInterest = 0.4;

    // // Set dailyRoi based on stakingAmount using a switch case
    switch (true) {
      case stakingAmount >= 20 && stakingAmount <= 5000:
        profitInterest = 0.004;
        break;
      case stakingAmount >= 5001 && stakingAmount <= 7000:
        profitInterest = 0.0075;
        break;
      case stakingAmount >= 7001 && stakingAmount <= 10000:
        profitInterest = 0.01;
        break;
      default:
        // Handle any other cases or provide a default value
        break;
    }

    // const newStake = new Stake({
    //   walletAddress: userAddress,
    //   initialStakingAmount: stakingAmount,
    //   UpdatedProfitStakingAmount: stakingAmount,
    //   dailyRoi: profitInterest,
    // });
    registeredUser.initialStakingAmount = stakingAmount;
    registeredUser.UpdatedProfitStakingAmount = 0;
    registeredUser.dailyRoi = profitInterest;
    registeredUser.dailyProfitAmount = stakingAmount * profitInterest;

    try {
      await registeredUser.save();
      return res.status(201).json({ message: "Staking successful." });
    } catch (error) {
      console.error("Staking Failed", error);
      return res.status(200).json({ error: "Staking failed." });
    }
  } else {
    return res.status(200).json({ message: `You are not registered` });
  }
});

app.post("/calculateLevelIncome", async (req, res) => {
  const { userAddress } = req.body;
  totalLevelIncome = 0;

  const registeredUser = await User.findOne({
    walletAddress: userAddress,
  });

  if (registeredUser) {
    try {
      const AllUsers = await User.find();
      const decisionTreeRoot = buildDecisionTree(AllUsers);
      printDecisionTree(decisionTreeRoot);
      const targetWalletAddress = userAddress;
      const targetUserNode = findUserInDecisionTree(
        decisionTreeRoot,
        targetWalletAddress
      );
      console.log(targetUserNode);

      CalculateLevelIncomeDownLine(targetUserNode, 0);
      console.log(
        "wallet address",
        userAddress,
        "totalLevelIncome",
        totalLevelIncome
      );
      return res.status(201).json({ totalLevelIncome: totalLevelIncome });
    } catch (err) {
      console.log("failed to calculate level income2", err);
    }
  } else {
    return res.status(200).json({ message: "You are not registered" });
  }
});

app.post("/calculateTeamDevIncome", async (req, res) => {
  const { userAddress } = req.body;
  totalLevelIncome = 0;
  const teamDevStage = [
    2500, 6000, 12000, 30000, 60000, 85000, 120000, 240000, 500000,
  ];
  const Test = [
    { totalBusines: 2500, Daily: 3, month: 2 },
    { totalBusines: 6000, Daily: 5, month: 3 },
    { totalBusines: 12000, Daily: 8, month: 6 },
    { totalBusines: 30000, Daily: 14, month: 9 },

    { totalBusines: 60000, Daily: 25, month: 12 },
    { totalBusines: 85000, Daily: 36, month: 15 },
    { totalBusines: 120000, Daily: 47, month: 18 },
    { totalBusines: 240000, Daily: 88, month: 24 },
    { totalBusines: 500000, Daily: 211, month: 30 },
  ];

  const registeredUser = await User.findOne({
    walletAddress: userAddress,
  });

  if (registeredUser) {
    try {
      const AllUsers = await User.find();
      const decisionTreeRoot = buildDecisionTree(AllUsers);
      printDecisionTree(decisionTreeRoot);
      const targetWalletAddress = "0xFfe7e55801a997739cE58e302D5e2DeE3b9Bd333";
      const targetUserNode = findUserInDecisionTree(
        decisionTreeRoot,
        targetWalletAddress
      );

      // Array to store subtree totals
      const subtreeTotals = [];

      for (let i = 0; i < targetUserNode.children.length; i++) {
        const childNode = targetUserNode.children[i];

        // Calculate subtree total
        const subtreeTotal = calculateSubtreeStakingAmount(childNode);

        // Add to array
        subtreeTotals.push(subtreeTotal);
      }
      let highestValue = 0;
      let totalDownBusiness = 0;
      for (let i = 0; i < subtreeTotals.length; i++) {
        if (subtreeTotals[i] >= highestValue) {
          highestValue = subtreeTotals[i];
        }
        totalDownBusiness = totalDownBusiness + subtreeTotals[i];
      }
      let ValidPlanAmount = [];
      const RestFiftyPercent = totalDownBusiness - highestValue;
      for (let i = 0; i < Test.length; i++) {
        if (
          highestValue >= Test[i].totalBusines * 0.5 &&
          RestFiftyPercent >= Test[i].totalBusines * 0.5
        ) {
          ValidPlanAmount.push(Test[i]);
        }
      }

      console.log("ValidPlanAmount", ValidPlanAmount);

      console.log(
        "highestValue",
        highestValue,
        "totalDownBusiness",
        totalDownBusiness
      );
      console.log(subtreeTotals);
      return res.status(200).json({ validTeamPlan: ValidPlanAmount, totalBusiness:totalDownBusiness });
    } catch (err) {
      console.log("failed to calculate level income2", err);
    }
  } else {
    return res.status(200).json({ message: "You are not registered" });
  }
});

app.post("/getUserDetail", async (req, res) => {
  const { userAddress } = req.body;

  const registeredUser = await User.findOne({
    walletAddress: userAddress,
  });

  if (registeredUser) {
    try {
      const getUser = await User.find({ walletAddress: userAddress });
      console.log(getUser);
      return res.status(200).json({ user: getUser });
    } catch (err) {
      console.log("failed to calculate level income2", err);
    }
  } else {
    return res.status(200).json({ message: "You are not registered" });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
