import { collection, db, getDocs } from "./firebase.js";

const AdminApp = {
  wave: null,
  stats: {
    tasks: [],
    users: [],
    counts: {
      totalTasks: 0,
      fundedTasks: 0,
      pendingReview: 0,
      paidTasks: 0,
      brands: 0,
      influencers: 0,
      admins: 0,
    },
  },

  load: async () => {
    await AdminApp.loadWeb3();
    await AdminApp.loadContract();
    await AdminApp.loadUsers();
    await AdminApp.loadTasks();
    AdminApp.initNavigation();
    AdminApp.render();
  },

  loadWeb3: async () => {
    if (!window.ethereum) {
      throw new Error("MetaMask is required for the admin dashboard.");
    }

    window.web3 = new Web3(window.ethereum);
    await window.ethereum.request({ method: "eth_requestAccounts" });
  },

  loadContract: async () => {
    const wave = await $.getJSON("Wave.json");
    const networkId = await window.web3.eth.net.getId();
    const deployed = wave.networks?.[networkId];
    if (!deployed?.address) {
      throw new Error(`Wave not deployed on chain id ${networkId}.`);
    }

    AdminApp.wave = new window.web3.eth.Contract(wave.abi, deployed.address);
  },

  loadUsers: async () => {
    const snap = await getDocs(collection(db, "users"));
    const users = snap.docs.map((entry) => ({
      id: entry.id,
      ...entry.data(),
    }));

    AdminApp.stats.users = users;
    AdminApp.stats.counts.brands = users.filter((user) => user.role === "brand").length;
    AdminApp.stats.counts.influencers = users.filter((user) => user.role === "influencer").length;
    AdminApp.stats.counts.admins = users.filter((user) => user.role === "admin").length;
  },

  loadTasks: async () => {
    const taskCount = Number(await AdminApp.wave.methods.taskCount().call());
    const tasks = [];

    for (let i = 1; i <= taskCount; i += 1) {
      const t = await AdminApp.wave.methods.getTask(i).call();
      tasks.push({
        id: Number(t.id ?? t[0]),
        content: t.content ?? t[1],
        completed: t.completed ?? t[2],
        influencer: t.influencer ?? t[3],
        value: Number(t.value ?? t[4]),
        paid: t.paid ?? t[5],
        proof: t.proof ?? t[6],
        proofSubmitted: t.proofSubmitted ?? t[7],
        rejectionNote: t.rejectionNote ?? t[8],
      });
    }

    AdminApp.stats.tasks = tasks;
    AdminApp.stats.counts.totalTasks = tasks.length;
    AdminApp.stats.counts.fundedTasks = tasks.filter((task) => task.value > 0 || task.paid).length;
    AdminApp.stats.counts.pendingReview = tasks.filter(
      (task) => task.proofSubmitted && !task.completed
    ).length;
    AdminApp.stats.counts.paidTasks = tasks.filter((task) => task.paid).length;
  },

  initNavigation: () => {
    const viewMap = {
      tasks: "#adminTasksView",
      users: "#adminUsersView",
      campaigns: "#adminCampaignsView",
    };

    $(".admin-link").on("click", function () {
      const view = $(this).data("view");
      if (!viewMap[view]) return;

      $(".admin-link").removeClass("active");
      $(this).addClass("active");
      $(".admin-view").removeClass("active");
      $(viewMap[view]).addClass("active");
    });
  },

  render: () => {
    const { counts, tasks, users } = AdminApp.stats;

    $("#adminTaskCount").text(counts.totalTasks);
    $("#adminUserCount").text(users.length);
    $("#adminCampaignCount").text(Math.max(1, counts.totalTasks ? 1 : 0));
    $("#adminFundedCount").text(counts.fundedTasks);
    $("#adminReviewCount").text(counts.pendingReview);
    $("#adminPaidCount").text(counts.paidTasks);
    $("#adminBrandCount").text(counts.brands);
    $("#adminInfluencerCount").text(counts.influencers);
    $("#adminRoleCount").text(counts.admins);

    $("#adminTaskRows").html(
      tasks
        .map((task) => {
          const valueEth = task.paid
            ? "Paid out"
            : task.value > 0
              ? `${window.web3.utils.fromWei(String(task.value), "ether")} ETH`
              : "Unfunded";
          const status = task.paid
            ? "Paid"
            : task.completed
              ? "Approved"
              : task.proofSubmitted
                ? "In review"
                : task.value > 0
                  ? "Funded"
                  : "Open";

          return `
            <tr>
              <td>#${task.id}</td>
              <td>${task.content}</td>
              <td>${status}</td>
              <td>${valueEth}</td>
              <td>${task.influencer && task.influencer !== "0x0000000000000000000000000000000000000000" ? task.influencer : "Not assigned"}</td>
            </tr>
          `;
        })
        .join("")
    );

    $("#adminUserRows").html(
      users
        .map((user) => {
          return `
            <tr>
              <td>${user.name || user.fullName || "Unknown"}</td>
              <td>${user.email || "-"}</td>
              <td>${user.role || "-"}</td>
              <td>${user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "-"}</td>
            </tr>
          `;
        })
        .join("")
    );

    const openTasks = tasks.filter((task) => !task.proofSubmitted && !task.completed && !task.paid).length;
    const fundedTasks = tasks.filter((task) => task.value > 0 && !task.paid).length;
    const paidTasks = tasks.filter((task) => task.paid).length;

    $("#campaignSnapshotRows").html(`
      <tr>
        <td>Wave Core Campaigns</td>
        <td>${counts.totalTasks}</td>
        <td>${openTasks}</td>
        <td>${fundedTasks}</td>
        <td>${counts.pendingReview}</td>
        <td>${paidTasks}</td>
      </tr>
    `);
  },
};

window.addEventListener("load", async function () {
  await window.WaveAuthGuard?.ready;
  if (window.WaveAuthGuard && !window.WaveAuthGuard.authorized) return;

  try {
    await AdminApp.load();
  } catch (error) {
    console.error("Admin dashboard failed to load", error);
    const loader = document.getElementById("adminLoader");
    if (loader) {
      loader.textContent = error.message || "Admin dashboard failed to load.";
    }
  }
});
