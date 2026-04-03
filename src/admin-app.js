import { collection, db, getDocs } from "./firebase.js";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const AdminApp = {
  wave: null,
  stats: {
    tasks: [],
    users: [],
    financials: {
      fundedEvents: [],
      paidEvents: [],
      totalFundedEth: 0,
      totalPaidEth: 0,
    },
    counts: {
      totalTasks: 0,
      fundedTasks: 0,
      pendingReview: 0,
      paidTasks: 0,
      brands: 0,
      influencers: 0,
      admins: 0,
    },
    report: {
      generatedAt: "",
      totalLockedEth: 0,
      totalFundedEth: 0,
      totalPaidEth: 0,
      approvalRate: 0,
      statusBreakdown: [],
      latestActivityLabel: "No funding or payout activity recorded yet.",
      summaryText: "",
    },
  },

  load: async () => {
    await AdminApp.loadWeb3();
    await AdminApp.loadContract();
    await AdminApp.refreshData();
    AdminApp.initNavigation();
    AdminApp.initReportActions();
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

  refreshData: async () => {
    await Promise.all([AdminApp.loadUsers(), AdminApp.loadTasks()]);
    await AdminApp.loadFinancials();
    await AdminApp.buildReport();
    AdminApp.render();
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
      const task = await AdminApp.wave.methods.getTask(i).call();
      tasks.push({
        id: Number(task.id ?? task[0]),
        content: task.content ?? task[1],
        completed: task.completed ?? task[2],
        influencer: task.influencer ?? task[3],
        value: Number(task.value ?? task[4]),
        paid: task.paid ?? task[5],
        proof: task.proof ?? task[6],
        proofSubmitted: task.proofSubmitted ?? task[7],
        rejectionNote: task.rejectionNote ?? task[8],
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

  loadFinancials: async () => {
    const financials = {
      fundedEvents: [],
      paidEvents: [],
      totalFundedEth: 0,
      totalPaidEth: 0,
    };

    try {
      const [fundedEvents, paidEvents] = await Promise.all([
        AdminApp.wave.getPastEvents("TaskFunded", {
          fromBlock: 0,
          toBlock: "latest",
        }),
        AdminApp.wave.getPastEvents("TaskPaid", {
          fromBlock: 0,
          toBlock: "latest",
        }),
      ]);

      financials.fundedEvents = fundedEvents;
      financials.paidEvents = paidEvents;
      financials.totalFundedEth = fundedEvents.reduce(
        (sum, event) => sum + AdminApp.weiToEth(event.returnValues.value),
        0
      );
      financials.totalPaidEth = paidEvents.reduce(
        (sum, event) => sum + AdminApp.weiToEth(event.returnValues.value),
        0
      );
    } catch (error) {
      console.warn("Admin report event history unavailable.", error);
    }

    AdminApp.stats.financials = financials;
  },

  buildReport: async () => {
    const { counts, financials, tasks, users } = AdminApp.stats;

    const totalLockedEth = tasks.reduce((sum, task) => sum + AdminApp.weiToEth(task.value), 0);
    const openTasks = tasks.filter((task) => AdminApp.getTaskStatus(task) === "Open").length;
    const fundedTasks = tasks.filter((task) => AdminApp.getTaskStatus(task) === "Funded").length;
    const rejectedTasks = tasks.filter((task) => AdminApp.getTaskStatus(task) === "Rejected").length;
    const approvedTasks = tasks.filter((task) => AdminApp.getTaskStatus(task) === "Approved").length;
    const paidTasks = tasks.filter((task) => AdminApp.getTaskStatus(task) === "Paid").length;
    const approvalRate = counts.totalTasks
      ? ((approvedTasks + paidTasks) / counts.totalTasks) * 100
      : 0;

    let latestActivityLabel = "No funding or payout activity recorded yet.";
    const latestEvent = [...financials.fundedEvents, ...financials.paidEvents].sort(
      (left, right) => Number(right.blockNumber) - Number(left.blockNumber)
    )[0];

    if (latestEvent) {
      try {
        const block = await window.web3.eth.getBlock(latestEvent.blockNumber);
        const taskId = latestEvent.returnValues.id;
        const eventLabel = latestEvent.event === "TaskPaid" ? "Payout released" : "Task funded";
        latestActivityLabel = `${eventLabel} for task #${taskId} on ${AdminApp.formatDate(
          block.timestamp * 1000
        )}`;
      } catch (error) {
        latestActivityLabel = "Recent on-chain activity detected, but the timestamp could not be loaded.";
      }
    }

    const summaryText = [
      "Wave Platform Report",
      `Generated: ${AdminApp.formatDate(Date.now())}`,
      "",
      `Users: ${users.length} total (${counts.brands} brands, ${counts.influencers} influencers, ${counts.admins} admins)`,
      `Tasks: ${counts.totalTasks} total (${openTasks} open, ${fundedTasks} funded, ${counts.pendingReview} in review, ${approvedTasks} approved awaiting payout, ${paidTasks} paid, ${rejectedTasks} rejected)`,
      `Funding: ${AdminApp.formatEth(financials.totalFundedEth)} ETH funded in total, ${AdminApp.formatEth(totalLockedEth)} ETH still locked, ${AdminApp.formatEth(financials.totalPaidEth)} ETH already released`,
      `Approval rate: ${AdminApp.formatPercent(approvalRate)}`,
      `Latest activity: ${latestActivityLabel}`,
    ].join("\n");

    AdminApp.stats.report = {
      generatedAt: new Date().toISOString(),
      totalLockedEth,
      totalFundedEth: financials.totalFundedEth,
      totalPaidEth: financials.totalPaidEth,
      approvalRate,
      statusBreakdown: [
        { label: "Open", count: openTasks },
        { label: "Funded", count: fundedTasks },
        { label: "In review", count: counts.pendingReview },
        { label: "Approved", count: approvedTasks },
        { label: "Paid", count: paidTasks },
        { label: "Rejected", count: rejectedTasks },
      ],
      latestActivityLabel,
      summaryText,
    };
  },

  initNavigation: () => {
    const viewMap = {
      tasks: "#adminTasksView",
      users: "#adminUsersView",
      campaigns: "#adminCampaignsView",
      reports: "#adminReportsView",
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

  initReportActions: () => {
    $("#refreshReportData").on("click", async function () {
      const button = $(this);
      const originalText = button.text();

      button.prop("disabled", true).text("Refreshing...");

      try {
        await AdminApp.refreshData();
      } catch (error) {
        console.error("Report refresh failed", error);
        alert(error.message || "Failed to refresh report.");
      } finally {
        button.prop("disabled", false).text(originalText);
      }
    });

    $("#downloadReportCsv").on("click", AdminApp.downloadReportCsv);
    $("#downloadReportTxt").on("click", AdminApp.downloadReportTxt);
  },

  render: () => {
    const { counts, report, tasks, users } = AdminApp.stats;

    $("#adminTaskCount").text(counts.totalTasks);
    $("#adminUserCount").text(users.length);
    $("#adminCampaignCount").text(report.statusBreakdown.filter((entry) => entry.count > 0).length);
    $("#adminFundedCount").text(counts.fundedTasks);
    $("#adminReviewCount").text(counts.pendingReview);
    $("#adminPaidCount").text(counts.paidTasks);
    $("#adminBrandCount").text(counts.brands);
    $("#adminInfluencerCount").text(counts.influencers);
    $("#adminRoleCount").text(counts.admins);

    $("#adminTaskRows").html(
      tasks
        .map((task) => {
          return `
            <tr>
              <td>#${task.id}</td>
              <td>${AdminApp.escapeHtml(task.content)}</td>
              <td>${AdminApp.getTaskStatus(task)}</td>
              <td>${AdminApp.getEscrowLabel(task)}</td>
              <td>${AdminApp.escapeHtml(AdminApp.getDisplayInfluencer(task))}</td>
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
              <td>${AdminApp.escapeHtml(user.name || user.fullName || "Unknown")}</td>
              <td>${AdminApp.escapeHtml(user.email || "-")}</td>
              <td>${AdminApp.escapeHtml(user.role || "-")}</td>
              <td>${AdminApp.escapeHtml(AdminApp.formatUserDate(user.createdAt))}</td>
            </tr>
          `;
        })
        .join("")
    );

    const openTasks = tasks.filter((task) => AdminApp.getTaskStatus(task) === "Open").length;
    const fundedTasks = tasks.filter((task) => AdminApp.getTaskStatus(task) === "Funded").length;
    const paidTasks = tasks.filter((task) => AdminApp.getTaskStatus(task) === "Paid").length;

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

    $("#reportGeneratedAt").text(AdminApp.formatDate(report.generatedAt));
    $("#reportLatestActivity").text(report.latestActivityLabel);
    $("#reportTotalFundedEth").text(`${AdminApp.formatEth(report.totalFundedEth)} ETH`);
    $("#reportReleasedEth").text(`${AdminApp.formatEth(report.totalPaidEth)} ETH`);
    $("#reportLockedEth").text(`${AdminApp.formatEth(report.totalLockedEth)} ETH`);
    $("#reportApprovalRate").text(AdminApp.formatPercent(report.approvalRate));
    $("#reportSummaryPreview").val(report.summaryText);
  },

  getTaskStatus: (task) => {
    if (task.paid) return "Paid";
    if (task.completed) return "Approved";
    if (task.proofSubmitted) return "In review";
    if (task.rejectionNote) return "Rejected";
    if (task.value > 0) return "Funded";
    return "Open";
  },

  getDisplayInfluencer: (task) => {
    if (!task.influencer || task.influencer === ZERO_ADDRESS) {
      return "Not assigned";
    }

    return task.influencer;
  },

  getEscrowLabel: (task) => {
    if (task.paid) return "Released";
    if (task.value > 0) return `${AdminApp.formatEth(AdminApp.weiToEth(task.value))} ETH`;
    return "Unfunded";
  },

  downloadReportTxt: () => {
    const text = AdminApp.stats.report.summaryText;
    AdminApp.downloadFile(
      "wave-platform-report.txt",
      text,
      "text/plain;charset=utf-8"
    );
  },

  downloadReportCsv: () => {
    const { counts, report, tasks, users } = AdminApp.stats;
    const rows = [
      ["Metric", "Value"],
      ["Generated At", AdminApp.formatDate(report.generatedAt)],
      ["Registered Users", String(users.length)],
      ["Brands", String(counts.brands)],
      ["Influencers", String(counts.influencers)],
      ["Admins", String(counts.admins)],
      ["Total Tasks", String(counts.totalTasks)],
      ["Funded Tasks", String(counts.fundedTasks)],
      ["Pending Review", String(counts.pendingReview)],
      ["Paid Tasks", String(counts.paidTasks)],
      ["Total Funded ETH", AdminApp.formatEth(report.totalFundedEth)],
      ["Released ETH", AdminApp.formatEth(report.totalPaidEth)],
      ["Locked Escrow ETH", AdminApp.formatEth(report.totalLockedEth)],
      ["Approval Rate", AdminApp.formatPercent(report.approvalRate)],
      ["Latest Activity", report.latestActivityLabel],
      [],
      ["Task ID", "Task", "Status", "Current Escrow ETH", "Influencer", "Proof Submitted"],
      ...tasks.map((task) => [
        String(task.id),
        task.content,
        AdminApp.getTaskStatus(task),
        AdminApp.getEscrowLabel(task),
        AdminApp.getDisplayInfluencer(task),
        task.proofSubmitted ? "Yes" : "No",
      ]),
      [],
      ["User", "Email", "Role", "Created"],
      ...users.map((user) => [
        user.name || user.fullName || "Unknown",
        user.email || "-",
        user.role || "-",
        AdminApp.formatUserDate(user.createdAt),
      ]),
    ];

    const csv = rows.map((row) => row.map(AdminApp.escapeCsvCell).join(",")).join("\n");
    AdminApp.downloadFile("wave-platform-report.csv", csv, "text/csv;charset=utf-8");
  },

  downloadFile: (filename, contents, type) => {
    const blob = new Blob([contents], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  },

  formatEth: (value) => Number(value || 0).toFixed(3),

  formatPercent: (value) => `${Number(value || 0).toFixed(1)}%`,

  formatDate: (value) => {
    if (!value) return "-";
    return new Date(value).toLocaleString();
  },

  formatUserDate: (value) => {
    if (!value) return "-";

    if (typeof value === "string" || typeof value === "number") {
      return new Date(value).toLocaleDateString();
    }

    if (typeof value === "object" && typeof value.seconds === "number") {
      return new Date(value.seconds * 1000).toLocaleDateString();
    }

    return "-";
  },

  weiToEth: (value) => Number(window.web3.utils.fromWei(String(value || 0), "ether")),

  escapeHtml: (value) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;"),

  escapeCsvCell: (value) => `"${String(value ?? "").replaceAll('"', '""')}"`,
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
