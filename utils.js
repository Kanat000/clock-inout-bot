const dayjs = require("dayjs");
const users = require("./users");

const userMap = new Map(Object.entries(users));

const isFriend = (chat_id) => {
  return userMap.has(String(chat_id));
};

const getUserIdByChatId = (chat_id) => {
  return userMap.get(String(chat_id));
};

const getStatusText = (ctx) => {
  return ctx.session?.status === 1 ? '"приход"' : '"уход"';
};
const getDayText = (datetime) => {
  const now = dayjs();
  const target = dayjs(datetime);
  const normalizedNow = now.startOf("day");
  const normalizedTarget = target.startOf("day");

  const diffInDays = normalizedNow.diff(normalizedTarget, "d");
  return diffInDays === 1 ? "вчера" : "сегодня";
};
const getTimeText = (datetime) => {
  const target = dayjs(datetime);
  return target.format("HH:mm:ss").toString();
};

const getTimeIfTextIsCorrectTime = (ctx) => {
  const text = ctx.message.text;
  const timeArr = text.split(":");
  if (timeArr.length < 2) return [false, undefined];
  const hour = parseInt(timeArr[0]);
  const minute = parseInt(timeArr[1]);
  const seconds = parseInt(timeArr[2]);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return [false, undefined];
  if (hour >= 24 || hour < 0 || minute >= 60 || minute < 0)
    return [false, undefined];

  return [
    true,
    {
      hour,
      minute,
      seconds:
        Number.isNaN(seconds) || seconds >= 60 || seconds < 0 ? 0 : seconds,
    },
  ];
};

module.exports = {
  isFriend,
  getUserIdByChatId,
  getStatusText,
  getDayText,
  getTimeText,
  getTimeIfTextIsCorrectTime,
};
