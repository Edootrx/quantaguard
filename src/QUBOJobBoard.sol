// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title QUBOJobBoard
/// @notice Useful-work job board anticipating the QMS v2 PoUW / QUBO marketplace.
/// @dev QMS vision: validators / solvers earn rewards for solving QUBO
///      (Quadratic Unconstrained Binary Optimization) problems — e.g. portfolio
///      selection — instead of pure hash grinding. This board is the application-
///      layer prototype on QMS v0.1 EVM today:
///        client locks QMS reward + posts problem hash → solvers submit solution
///        hash + claimed objective score → after deadline, lowest score wins.
///      Honest staging: on v0.1 the objective score is *claimed*, not verified
///      on-chain (QUBO verification is the v2 integration point — a verifier
///      contract / PoUW consensus hook replaces `settle`'s trust assumption).
///      The hash commitments ensure solutions cannot be copied after reveal
///      ordering matters: first submission of a score wins ties.
contract QUBOJobBoard {
    enum JobStatus { Open, Settled, Cancelled }

    struct Job {
        address poster;
        bytes32 problemHash;
        uint256 reward;
        uint256 deadline;
        JobStatus status;
        address bestSolver;
        int256 bestScore;
        bytes32 bestSolutionHash;
        uint256 submissionCount;
    }

    struct Submission {
        address solver;
        bytes32 solutionHash;
        int256 objectiveScore;
        uint256 submittedAt;
    }

    uint256 public nextJobId = 1;
    mapping(uint256 => Job) private _jobs;
    mapping(uint256 => Submission[]) private _submissions;

    bool private _locked;
    modifier nonReentrant() {
        require(!_locked, "REENTRANT");
        _locked = true;
        _;
        _locked = false;
    }

    event JobPosted(uint256 indexed jobId, address indexed poster, bytes32 problemHash, uint256 reward, uint256 deadline);
    event SolutionSubmitted(uint256 indexed jobId, address indexed solver, bytes32 solutionHash, int256 objectiveScore);
    event JobSettled(uint256 indexed jobId, address indexed winner, int256 bestScore, uint256 reward);
    event JobCancelled(uint256 indexed jobId, address indexed poster, uint256 refund);

    error ZeroReward();
    error DeadlineInPast();
    error JobNotOpen();
    error JobNotFound();
    error DeadlineNotReached();
    error NoSubmissions();
    error NotPoster();
    error HasSubmissions();
    error TransferFailed();

    /// @notice Post a QUBO job, locking `msg.value` as the reward.
    /// @param problemHash Hash of the off-chain QUBO instance (Q matrix, constraints, metadata).
    /// @param deadline Unix timestamp after which the job can be settled.
    function postJob(bytes32 problemHash, uint256 deadline) external payable returns (uint256 jobId) {
        if (msg.value == 0) revert ZeroReward();
        if (deadline <= block.timestamp) revert DeadlineInPast();
        jobId = nextJobId++;
        _jobs[jobId] = Job({
            poster: msg.sender,
            problemHash: problemHash,
            reward: msg.value,
            deadline: deadline,
            status: JobStatus.Open,
            bestSolver: address(0),
            bestScore: type(int256).max,
            bestSolutionHash: bytes32(0),
            submissionCount: 0
        });
        emit JobPosted(jobId, msg.sender, problemHash, msg.value, deadline);
    }

    /// @notice Submit a solution. Lower objective score is better (minimisation).
    function submitSolution(uint256 jobId, bytes32 solutionHash, int256 objectiveScore) external {
        Job storage j = _jobs[jobId];
        if (j.poster == address(0)) revert JobNotFound();
        if (j.status != JobStatus.Open) revert JobNotOpen();
        require(block.timestamp <= j.deadline, "DEADLINE_PASSED");
        _submissions[jobId].push(Submission(msg.sender, solutionHash, objectiveScore, block.timestamp));
        j.submissionCount++;
        if (objectiveScore < j.bestScore) {
            j.bestScore = objectiveScore;
            j.bestSolver = msg.sender;
            j.bestSolutionHash = solutionHash;
        }
        emit SolutionSubmitted(jobId, msg.sender, solutionHash, objectiveScore);
    }

    /// @notice Settle after deadline: best (lowest-score) solver is paid in full.
    function settle(uint256 jobId) external nonReentrant {
        Job storage j = _jobs[jobId];
        if (j.poster == address(0)) revert JobNotFound();
        if (j.status != JobStatus.Open) revert JobNotOpen();
        if (block.timestamp <= j.deadline) revert DeadlineNotReached();
        if (j.submissionCount == 0) revert NoSubmissions();
        // effects
        address winner = j.bestSolver;
        uint256 reward = j.reward;
        int256 score = j.bestScore;
        j.status = JobStatus.Settled;
        j.reward = 0;
        // interaction
        (bool ok, ) = payable(winner).call{value: reward}("");
        if (!ok) revert TransferFailed();
        emit JobSettled(jobId, winner, score, reward);
    }

    /// @notice Poster cancels before any solution arrives; full refund.
    function cancelJob(uint256 jobId) external nonReentrant {
        Job storage j = _jobs[jobId];
        if (j.poster == address(0)) revert JobNotFound();
        if (msg.sender != j.poster) revert NotPoster();
        if (j.status != JobStatus.Open) revert JobNotOpen();
        if (j.submissionCount != 0) revert HasSubmissions();
        uint256 refund = j.reward;
        j.status = JobStatus.Cancelled;
        j.reward = 0;
        (bool ok, ) = payable(j.poster).call{value: refund}("");
        if (!ok) revert TransferFailed();
        emit JobCancelled(jobId, j.poster, refund);
    }

    function getJob(uint256 jobId) external view returns (Job memory) {
        return _jobs[jobId];
    }

    function getSubmission(uint256 jobId, uint256 idx) external view returns (Submission memory) {
        return _submissions[jobId][idx];
    }

    function submissionCount(uint256 jobId) external view returns (uint256) {
        return _jobs[jobId].submissionCount;
    }
}
