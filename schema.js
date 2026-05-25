const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema({
  userMsg: { type: String, required: true },
  botReply: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

const remarksSchema = new mongoose.Schema({
  remark: String,
  timestamp: { type: Date, default: Date.now },
});

const userSchema = new mongoose.Schema({
  username: { type: String },
  useremail: { type: String, unique: true, required: true },
  userNumber: { type: String, required: true, unique: true }, 
  password: { type: String },
  role: { 
    type: String, 
    enum: ["admin", "user", "cert"], 
    default: "user" 
  }
});


const InternSchema = new mongoose.Schema({
  salutation: { type: String, trim: true, default: "" },
  userName: { type: String, trim: true, default: "" },
  userEmail: { type: String, trim: true, lowercase: true, default: "" },
  phone: { type: String, trim: true, default: "" },
  reg_no: { type: String, trim: true, default: "" },
  year_of_study: { type: String, trim: true, default: "" },
  college: { type: String, trim: true, default: "" },
  college_location: { type: String, trim: true, default: "" },
  degree: { type: String, trim: true, default: "" },
  other_degree: { type: String, trim: true, default: "" },
  department: { type: String, trim: true, default: "" },
  internship: { type: String, trim: true, default: "" },
  other_internship: { type: String, trim: true, default: "" },
  workshop: { type: String, trim: true, default: "" },
  other_workshop: { type: String, trim: true, default: "" },
  start_date: { type: Date, default: null },
  end_date: { type: Date, default: null },
  date_scheduled: { type: Date, default: null },
  issue_date: { type: Date, default: null },
  company: { type: String, trim: true, default: "" },
  batch_code: { type: String, trim: true, default: "" }
}, { timestamps: true });



const feesSchema = new mongoose.Schema({
  billedAmount: { type: Number, default: 0 },
  billedAt: { type: Date, default: null },
  updatedAt: { type: Date, default: null },
  installments: [
    {
      number: Number,
      dueDate: Date,
      amount: Number,
      status: {
        type: String,
        enum: ["Pending", "Paid"],
        default: "Pending"
      },
         billGenerated: { type: Boolean, default: false },
         billGeneratedAt: { type: Date, default: null },
         billUrl: { type: String, default: null },
         paidAt: { type: Date, default: null }
    }
  ]
});

const chatSchema = new mongoose.Schema({
  userName: { type: String },
  userNumber: { type: String, required: true, unique: true },
  courseofintrest: { type: String },
  course: { type: String, default: null },
  leadfrom: { type: String },
  assignedto: { type: String },
  batchId: { type: String, default: null },
  conversations: [conversationSchema],
  programType: { type: String },
  city: { type: String },
  profession: { type: String },
  location: { type: String },
  status: { type: String, default: "Cold" },
  pipeline: { type: String, default: "New" },
  remarks: [remarksSchema],
  reminder: { type: Date, default: null },
  batchId: { type: String, default: null },
  Trainer: { type: String, default: null },
  batch_date : { type: String, default: null },
  fees: { type: feesSchema, default: () => ({}) },
  followUpCount: { type: Number, default: 0 },
  respondedAfterFollowUp: { type: Boolean, default: false },
  lastFollowUpSentAt: { type: Date, default: null },
  datecreated: { type: Date, default: Date.now },
  lastInteracted: { type: Date, default: Date.now },
  aiAnalysis: { type: Object, default: null },
  InternDetails : [InternSchema],
  certificates: [
    {
      success: { type: Boolean, default: false },
      fileName: { type: String, default: null },
      message: { type: String, default: null },
      s3: { type: mongoose.Schema.Types.Mixed, default: null }
    }
  ],
  is_leader : { type: Boolean, default: false }
});

// --- Static Method for Round Robin Assignment ---
chatSchema.statics.getNextAssignee = async function() {
  const User = mongoose.model("User");

  const db = mongoose.connection.db;
  const excludedConfig = db ? await db.collection('configs').findOne({ key: 'auto_assign_excluded_staffs' }) : null;
  const excludedStaffs = excludedConfig ? excludedConfig.value : [];

  const allStaffs = await User.find({ role: 'user' }).sort({ username: 1 });
  const staffs = allStaffs.filter(s => !excludedStaffs.includes(s.username));
  if (staffs.length === 0) return null;

  const staffUsernames = staffs.map(s => s.username);

  const lastAssignedLead = await this.findOne({ assignedto: { $in: staffUsernames } })
    .sort({ datecreated: -1 });

  if (!lastAssignedLead || !lastAssignedLead.assignedto) return staffs[0].username;

  const lastIndex = staffUsernames.indexOf(lastAssignedLead.assignedto);
  const nextIndex = (lastIndex + 1) % staffs.length;
  return staffs[nextIndex].username;
};

// --- Pre-Save Hook for Auto Assignment ---
chatSchema.pre('save', async function(next) {
  if (this.isNew && (!this.assignedto || this.assignedto.trim() === "")) {
    try {
      const db = mongoose.connection.db;
      if (db) {
        const config = await db.collection('configs').findOne({ key: 'auto_assign_enabled' });
        const autoAssignEnabled = config ? !!config.value : true;

        if (autoAssignEnabled) {
          const assignee = await this.constructor.getNextAssignee();
          if (assignee) {
            this.assignedto = assignee;
          }
        }
      }
    } catch (err) {
      console.error("Auto-assign hook error:", err);
    }
  }
  next();
});


chatSchema.pre("findOneAndUpdate", async function (next) {
  // get the document BEFORE update
  const docToUpdate = await this.model.findOne(this.getQuery()).lean();

  // store previous value on the query object
  this._oldAssignedTo = docToUpdate?.assignedto;

  next();
});


chatSchema.post("findOneAndUpdate", async function (doc) {
  if (!doc) return;

  const update = this.getUpdate();

  // 🧠 safely extract assignedto
  const newAssignedTo =
    update?.$set?.assignedto ??
    update?.assignedto ??
    null;

  // 🔐 if assignedto not part of update → DO NOTHING
  if (newAssignedTo === null) return;

  const oldAssignedTo = this._oldAssignedTo;

  // 🔐 notify ONLY if value actually changed
  if (!oldAssignedTo || oldAssignedTo === newAssignedTo) return;

  try {
    await NotifyCounsellor({
      leadId: doc._id,
      assignedTo: newAssignedTo,
      userNumber: doc.userNumber,
      userName: doc.userName,
      message: `Lead assigned to ${newAssignedTo}`
    });
  } catch (err) {
    console.error("NotifyCounsellor failed:", err);
  }
});

chatSchema.post("save", async function (doc) {
  // 🔐 notify ONLY when document is newly created
  if (!this.isNew) return;

  try {
    await NotifyCounsellor({
      leadId: doc._id,
      assignedTo: doc.assignedto,
      userNumber: doc.userNumber,
      userName: doc.userName,
      message: `New lead assigned to ${doc.assignedto}`
    });
  } catch (err) {
    console.error("NotifyCounsellor failed:", err);
  }
});

async function NotifyCounsellor(body) {
  console.log("Notify payload:", body);
  console.log("AssignedTo:", body.assignedTo);

  const response = await fetch(
    `${process.env.WP_CHAT_SERVICE_URL}/notify/crm`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }
  );

  const data = await response.json();
  console.log("Microservice response:", data);

  return data;
}


const trainerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  mobile: { type: String, required: true, unique: true },
  username: { type: String, unique: true, sparse: true },
  password: { type: String, default: null },
  batchIds: [{ type: String }]
});
const trainerTaskSchema = new mongoose.Schema({
  studentId: { type: String, required: true },
  trainerId: { type: String, required: true },
  batchId: { type: String },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  driveLink: { type: String, default: '' },
  studentRemark: { type: String, default: '' },
  trainerRemark: { type: String, default: '' },
  status: { type: String, enum: ['pending', 'completed'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

const trainerTopicSchema = new mongoose.Schema({
  title: { type: String, required: true },
  trainerId: { type: String, required: true },
  batchId: { type: String, required: true },
  date: { type: Date, default: Date.now }
});

const trainerTopicFeedbackSchema = new mongoose.Schema({
  topicId: { type: String, required: true },
  studentId: { type: String, required: true },
  status: { type: String, enum: ['pending', 'approved', 'denied'], default: 'pending' },
  updatedAt: { type: Date, default: Date.now }
});

const announcementSchema = new mongoose.Schema({
  trainerId: { type: String, required: true },
  batchId: { type: String, required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const attendanceSchema = new mongoose.Schema({
  trainerId: { type: String, required: true },
  batchId: { type: String, required: true },
  date: { type: Date, default: Date.now },
  studentId: { type: String, required: true },
  status: { type: String, enum: ['present', 'absent', 'late'], default: 'absent' },
  topicId: { type: String, default: null }
});

const userMonthlyTargetSchema = new mongoose.Schema({
  username: { type: String, required: true },
  year: { type: Number, required: true },
  month: { type: Number, required: true },
  target: { type: Number, default: 0 }
});
userMonthlyTargetSchema.index({ username: 1, year: 1, month: 1 }, { unique: true });

const User = mongoose.model("User", userSchema);
const Chat = mongoose.model("Chat", chatSchema);
const Trainer = mongoose.model("Trainer", trainerSchema);
const TrainerTask = mongoose.model("TrainerTask", trainerTaskSchema);
const TrainerTopic = mongoose.model("TrainerTopic", trainerTopicSchema);
const TrainerTopicFeedback = mongoose.model("TrainerTopicFeedback", trainerTopicFeedbackSchema);
const Announcement = mongoose.model("Announcement", announcementSchema);
const Attendance = mongoose.model("Attendance", attendanceSchema);
const UserMonthlyTarget = mongoose.model("UserMonthlyTarget", userMonthlyTargetSchema);

module.exports = { User, Chat, Trainer, TrainerTask, TrainerTopic, TrainerTopicFeedback, Announcement, Attendance, UserMonthlyTarget };

