// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

contract Wave {
    uint public taskCount = 0;

    struct Task {
        uint id;
        string content;
        bool completed;
        address payable influencer;
        uint256 value;
        bool paid;
        string proof;
        bool proofSubmitted; 
        string rejectionNote;
    }

    mapping(uint => Task) public tasks;

    event TaskCreated(
        uint id,
        string content,
        bool completed
    );

    event TaskCompleted(
        uint id,
        bool completed
    );

    // NEW EVENTS
    event TaskFunded(uint id, address influencer, uint256 value);
    event TaskPaid(uint id, uint256 value, address influencer);

    constructor() {
        createTask("Film content for campaign");
    }

    function createTask(string memory _content) public {
        taskCount++;
        tasks[taskCount] = Task({
            id: taskCount,
            content: _content,
            completed: false,
            influencer: payable(address(0)),
            value: 0,
            paid: false,
            proof: "",
            proofSubmitted: false,
            rejectionNote: ""
        });

        emit TaskCreated(taskCount, _content, false);
    }

    function toggleCompleted(uint _id) public {
        Task storage _task = tasks[_id];
        _task.completed = !_task.completed;
        emit TaskCompleted(_id, _task.completed);
    }

    // 1 BRAND LOCKS ETH INTO THE TASK

    function fundTask(uint _id, address payable _influencer) public payable {
        Task storage _task = tasks[_id];

        require(_task.value == 0, "Already funded");
        require(!_task.paid, "Already paid");
        require(msg.value > 0, "Send ETH");

        _task.influencer = _influencer;
        _task.value = msg.value;

        emit TaskFunded(_id, _influencer, msg.value);
    }
function submitProof(uint _id, string calldata _proof) external {
    Task storage task = tasks[_id];

    require(task.value > 0, "Task not funded");
    require(task.influencer != address(0), "No influencer set");
    require(task.influencer == msg.sender, "Only assigned influencer");
    require(!task.proofSubmitted, "Already submitted");

    task.proof = _proof;
    task.proofSubmitted = true;
    task.rejectionNote = "";
}
function rejectProof(uint _id, string calldata _note) external {
    Task storage task = tasks[_id];

    require(task.value > 0, "Task not funded");
    require(task.influencer != address(0), "No influencer set");
    require(task.proofSubmitted == true, "No proof submitted yet");
    require(task.completed == false, "Already approved");

    // Reset proof + add note
    task.proof = "";
    task.proofSubmitted = false;
    task.rejectionNote = _note;
}
function approveTask(uint _id) public {
    Task storage task = tasks[_id];

    require(task.proofSubmitted, "Proof not submitted yet");
    require(!task.completed, "Already approved");

    task.completed = true;
}



    // 2️ BRAND RELEASES THE ETH TO INFLUENCER
   
    function releasePayment(uint _id) public {
        Task storage _task = tasks[_id];

        require(_task.value > 0, "No money locked");
        require(_task.proofSubmitted, "Proof not submitted");
        require(!_task.paid, "Already released");
        require(_task.completed == true, "Task not completed");
        uint256 amount = _task.value;

        _task.paid = true;
        _task.value = 0;

        _task.influencer.transfer(amount);
        emit TaskPaid(_id, amount, _task.influencer);
    }

//  VIEW: How much ETH is inside the whole smart contract

function getContractBalance() public view returns (uint256) {
    return address(this).balance;
}


//  VIEW: How much ETH is locked in a specific task

function getTaskBalance(uint _id) public view returns (uint256) {
    return tasks[_id].value;
}

//  VIEW: Which influencer is assigned to this task

function getTaskInfluencer(uint _id) public view returns (address) {
    return tasks[_id].influencer;
}
function getTask(uint _id) public view returns (
    uint id,
    string memory content,
    bool completed,
    address influencer,
    uint256 value,
    bool paid,
    string memory proof,
    bool proofSubmitted,
     string memory rejectionNote
) {
    Task memory t = tasks[_id];
    return (
        t.id,
        t.content,
        t.completed,
        t.influencer,
        t.value,
        t.paid,
        t.proof,
        t.proofSubmitted,
        t.rejectionNote
    );
}

}
