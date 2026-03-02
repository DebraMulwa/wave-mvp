App = {
  loading:false,
  contracts: {},
  account: null,
  web3Provider: null,
  balanceChart: null,
  stats: {
    taskCount: 0,
    openCount: 0,
    reviewCount: 0,
    approvedCount: 0,
    paidTasksCount: 0,
    pendingPayoutsEth: 0,
    lockedEth: 0,
  },

  load: async () => {
    console.log("App loading...");
    await App.loadWeb3();
    await App.loadAccount();
    await App.loadContract();
      // Load saved influencer wallet
    const saved = localStorage.getItem("influencerWallet");
    if (saved) {
      App.influencerWallet = saved;
      $('#influencerWallet').val(saved);
      $("#walletSavedMsg").show().text(`Saved: ${saved}`);
}

    await App.render();
    

  },

  renderKesConversions: (walletEth, lockedEth) => {
    const rateInput = document.getElementById("kesRate");
    let rate = 180000;
    if (rateInput) {
      const parsed = Number(rateInput.value || 0);
      rate = isFinite(parsed) && parsed > 0 ? parsed : rate;
    }

    const walletKes = walletEth * rate;
    const lockedKes = lockedEth * rate;

    const fmt = (n) => isFinite(n) ? `KES ${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "--";
    $("#walletKes").text(fmt(walletKes));
    $("#lockedKes").text(fmt(lockedKes));
  },

  loadWeb3: async () => {
    if (window.ethereum) {
      App.web3Provider = window.ethereum;
      window.web3 = new Web3(window.ethereum);

      try {
        await window.ethereum.request({ method: 'eth_requestAccounts' });
      } catch (e) {
        console.error("User denied MetaMask access");
      }

    } else {
      alert("Please install MetaMask");
    }
  },

  loadAccount: async () => {
    const accounts = await window.ethereum.request({
      method: 'eth_accounts'
    });
    App.account = accounts[0];
    console.log("Account loaded:", App.account);
    document.getElementById("account").innerText = App.account;
  },

  loadContract: async () => {
    const wave = await $.getJSON('Wave.json');
    const networkId = await web3.eth.net.getId();
    const deployed = wave.networks?.[networkId];
    if (!deployed?.address) {
      throw new Error(`Wave not deployed on chain id ${networkId}. Deploy and refresh.`);
    }
    App.wave = new web3.eth.Contract(wave.abi, deployed.address);
    console.log("Wave contract loaded:", App.wave);
  },
  render: async () => {
    if (App.loading) return;

    App.setLoading(true);
 // show account
    $('#account').html(App.account);
// load tasks
    await App.renderTasks()
 // show UI
    App.setLoading(false);
    // load balances AFTER UI is visible
    await App.renderBalances();
    App.renderSidebarViews();
  },

  renderTasks: async () => {
  // Clear columns
  $("#openTasks").html("");
  $("#deliveredTasks").html("");
  $("#approvedTasks").html("");
  $("#paidTasks").html("");
  let pendingPayoutsEth = 0;
  let paidTasksCount = 0;
  let openCount = 0;
  let reviewCount = 0;
  let approvedCount = 0;

  const taskCount = Number(await App.wave.methods.taskCount().call());
  const template = $("#taskTemplate");

  for (let i = 1; i <= taskCount; i++) {
    const t = await App.wave.methods.getTask(i).call();

    const id = Number(t.id ?? t[0]);
    const content = t.content ?? t[1];
    const completed = t.completed ?? t[2];
    const influencer = t.influencer ?? t[3];
    const value = Number(t.value ?? t[4]);
    const paid = t.paid ?? t[5];
    const proof = t.proof ?? t[6];
    const proofSubmitted = t.proofSubmitted ?? t[7];
    const rejectionNote = t.rejectionNote ?? t[8];

    const $task = template.clone();
    $task.attr("id", "");
    $task.css("display", "block");
    // ASSIGN IDS
$task.find(".fundTaskBtn").attr("data-id", id);
$task.find(".submitProofBtn").attr("data-id", id);
$task.find(".approveTaskBtn").attr("data-id", id);
$task.find(".rejectTaskBtn").attr("data-id", id);
$task.find(".releasePaymentBtn").attr("data-id", id);
    // Content section
    $task.find(".task-content").html(`
      <strong>#${id}</strong> – ${content}
      ${value > 0 ? `<div class="small">Value: ${web3.utils.fromWei(value.toString(), "ether")} ETH</div>` : ""}
      ${proofSubmitted ? `<div class="small">Proof: <a href="${proof}" target="_blank">${proof}</a></div>` : ""}
    `);

    const actions = $task.find(".task-actions");
    actions.find("button").hide();

    // LOGIC FOR WHICH COLUMN THIS TASK GOES TO
    if (!proofSubmitted && !completed) {
      openCount += 1;
      // COLUMN 1: OPEN
      actions.find(".fundTaskBtn").show().attr("data-id", id);
      actions.find(".submitProofBtn").show().attr("data-id", id);
      if (Number(value) > 0) {
  const btn = actions.find(".fundTaskBtn");
  btn.addClass("funded-btn");
  btn.prop("disabled", true);
  btn.text(`Funded • ${web3.utils.fromWei(value.toString(), "ether")} ETH`);
}
      $("#openTasks").append($task);

    } else if (proofSubmitted && !completed) {
      reviewCount += 1;
      // COLUMN 2: DELIVERED
      actions.find(".approveTaskBtn").show().attr("data-id", id);
      actions.find(".rejectTaskBtn").show().attr("data-id", id);
      $("#deliveredTasks").append($task);

    } else if (completed && !paid) {
      approvedCount += 1;
      // COLUMN 3: APPROVED
      actions.find(".releasePaymentBtn").show().attr("data-id", id);
      pendingPayoutsEth += Number(web3.utils.fromWei(value.toString(), "ether"));
      $("#approvedTasks").append($task);

    } else if (paid) {
      // COLUMN 4: PAID
      paidTasksCount += 1;
      $("#paidTasks").append($task);
    }
  }

  $("#pendingPayouts").text(pendingPayoutsEth.toFixed(3) + " ETH");
  $("#totalPaidMade").text(paidTasksCount);

  App.stats.taskCount = taskCount;
  App.stats.openCount = openCount;
  App.stats.reviewCount = reviewCount;
  App.stats.approvedCount = approvedCount;
  App.stats.paidTasksCount = paidTasksCount;
  App.stats.pendingPayoutsEth = pendingPayoutsEth;
  App.renderSidebarViews();

},

  renderBalanceChart: (walletEth, escrowEth) => {
    if (!window.Chart) return;
    const ctxEl = document.getElementById("balanceChart");
    if (!ctxEl) return;

    const data = [
      Math.max(walletEth, 0),
      Math.max(escrowEth, 0)
    ];

    if (App.balanceChart) {
      App.balanceChart.data.datasets[0].data = data;
      App.balanceChart.update();
      return;
    }

    App.balanceChart = new Chart(ctxEl.getContext("2d"), {
      type: "doughnut",
      data: {
        labels: ["Wallet", "Locked"],
        datasets: [
          {
            data,
            backgroundColor: ["#4f46e5", "#0ea5e9"],
            borderWidth: 0,
          },
        ],
      },
      options: {
        cutout: "62%",
        plugins: { legend: { position: "bottom" } },
      },
    });
  },

// BALANCES (brand + escrow)
  // -----------------------------
  renderBalances: async () => {
    try {
      // brand account balance
      const brandBalWei = await web3.eth.getBalance(App.account);
      const brandBalEth = Number(web3.utils.fromWei(brandBalWei, "ether"));
      $("#brandBalance").html(brandBalEth.toFixed(2) + " ETH");


      // contract balance = total escrow
      const contractAddr = App.wave.options.address;
      const escrowWei = await web3.eth.getBalance(contractAddr);
      const escrowEth = Number(web3.utils.fromWei(escrowWei, "ether"));

      $("#totalLocked").html(escrowEth.toFixed(2) + " ETH");

      App.renderBalanceChart(brandBalEth, escrowEth);
      App.renderKesConversions(brandBalEth, escrowEth);
      App.stats.lockedEth = escrowEth;
      App.renderSidebarViews();

    } catch (err) {
      console.error("BALANCE ERR:", err);
    }
  },

  initSidebarNavigation: () => {
    const map = {
      dashboard: "#brandDashboardView",
      campaigns: "#brandCampaignsView",
      payouts: "#brandPayoutsView",
    };

    $(".wave-menu-item").on("click", function () {
      const view = $(this).data("view");
      if (!view || !map[view]) return;

      $(".wave-menu-item").removeClass("active");
      $(this).addClass("active");
      $(".brand-view").removeClass("active");
      $(map[view]).addClass("active");
    });
  },

  renderSidebarViews: () => {
    $("#campaignTotalTasks").text(App.stats.taskCount ?? 0);
    $("#campaignOpenTasks").text(App.stats.openCount ?? 0);
    $("#campaignReviewTasks").text(App.stats.reviewCount ?? 0);
    $("#campaignApprovedTasks").text(App.stats.approvedCount ?? 0);
    $("#payoutPendingValue").text(`${(App.stats.pendingPayoutsEth ?? 0).toFixed(3)} ETH`);
    $("#payoutPaidTasks").text(App.stats.paidTasksCount ?? 0);
    $("#payoutLockedValue").text(`${(App.stats.lockedEth ?? 0).toFixed(3)} ETH`);
  },

  createTask: async () => {
    App.setLoading(true);

    const content = $('#newTask').val();
    await App.wave.methods.createTask(content).send({ from: App.account });
    alert("Task created!");
    window.location.reload();
  },
  
  saveInfluencerWallet: async () => {
  const rawInput = $('#influencerWallet').val() || "";
  const input = rawInput
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
    .replace(/[.,;:!?]+$/, "");

  const looksLikeAddress = /^0x[a-fA-F0-9]{40}$/.test(input);
  const isValidAddress = looksLikeAddress && web3.utils.isAddress(input);

  if (!isValidAddress) {
    alert("Please enter a valid wallet address.");
    return;
  }

  App.influencerWallet = input;
  localStorage.setItem("influencerWallet", input);

  $("#influencerWallet").val(input);
  $("#walletSavedMsg").show().text(`Saved: ${input}`);

},

  toggleCompleted: async (e) => {
    App.setLoading(true);

    const taskId = e.target.name;
    await App.wave.methods.toggleCompleted(taskId).send({ from: App.account });
    alert("Task updated!");

    window.location.reload();
  },

  fundTask: async function(taskId, amountEth) {
    try {
        const accounts = await web3.eth.getAccounts();
        const brand = accounts[0];
        const influencer = App.influencerWallet;

if (!influencer || !web3.utils.isAddress(influencer)) {
  alert("Influencer wallet not set. Please save a valid wallet first.");
  return;
}


        const value = web3.utils.toWei(amountEth.toString(), "ether");

        console.log(`Funding task ${taskId} with ${amountEth} ETH`);
        console.log("Brand:", brand);
        console.log("Influencer:", influencer);

        await App.wave.methods.fundTask(taskId, influencer).send({
            from: brand,
            value: value
        });

        alert("Payment sent!");
        await App.render();

    } catch (err) {
        console.error("FUND ERROR:", err);
        alert("Payment failed. Check console.");
    }
  },
  approveTask: async function(taskId) {
  try {
    const accounts = await web3.eth.getAccounts();
    const brand = accounts[0];

    console.log("Approving task:", taskId);

    await App.wave.methods.approveTask(taskId).send({ from: brand });
        alert("Task approved!");
        await App.render();

  } catch (err) {
    console.error("APPROVE ERROR:", err);
    alert("Failed to approve task");
  }
},
denyTask: async function(taskId) {
  const note = $("#rejectNote").val().trim();

  if (!note) {
    alert("Please enter a rejection note.");
    return;
  }

  try {
    await App.wave.methods.rejectProof(taskId, note).send({ from: App.account });
    
    alert("Task rejected.");
    $("#rejectModal").hide();
    $("#rejectNote").val("");

    await App.render();

  } catch (err) {
    console.error("REJECT ERROR:", err);
    alert("Failed to reject task");
  }
},

releasePayment: async function(taskId) {
  try {
    const accounts = await web3.eth.getAccounts();
    const brand = accounts[0];

    console.log("Releasing payment for task:", taskId);

    await App.wave.methods.releasePayment(taskId).send({ from: brand });

    alert("Payment released!");
    await App.render();

  } catch (err) {
    console.error("RELEASE ERROR:", err);
    alert("Failed to release payment");
  }
},

  setLoading: (boolean) => {
    App.loading = boolean;
    const loader = $('#loader');
    const content = $('#content');

    if (boolean) {
      loader.show();
      content.hide();
    } else {
      loader.hide();
      content.show();
    }
  }
};

window.addEventListener("load", function () {
  App.load();
$(document).off("click");
  App.initSidebarNavigation();

  // SAVE INFLUENCER WALLET
  $("#saveInfluencerBtn").on("click", function (e) {
    e.preventDefault();
    App.saveInfluencerWallet();
  });

  $("#influencerWallet").on("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      App.saveInfluencerWallet();
    }
  });

  // FUND BUTTON
  $(document).on("click", ".fundTaskBtn", function () {
    const taskId = $(this).data("id");
    const amount = prompt("Enter amount of ETH to fund:");
    if (!amount || isNaN(amount)) return alert("Invalid amount");
    App.fundTask(taskId, amount);
  });

  // APPROVE TASK
  $(document).on("click", ".approveTaskBtn", function () {
    App.approveTask($(this).data("id"));
  });

  // RELEASE PAYMENT
  $(document).on("click", ".releasePaymentBtn", function () {
    App.releasePayment($(this).data("id"));
  });

  // OPEN REJECTION MODAL
  let pendingRejectId = null;
  $(document).on("click", ".rejectTaskBtn", function () {
    pendingRejectId = $(this).data("id");
    $("#rejectModal").show();
  });

  // CONFIRM REJECTION
  $("#confirmRejectBtn").on("click", function () {
    App.denyTask(pendingRejectId);
  });
});
