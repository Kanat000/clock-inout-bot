const { Telegraf, session, Markup } = require("telegraf");
const fsPromises = require("fs").promises;
const process = require("node:process");
const axios = require("axios");
const dayjs = require("dayjs");
const constants = require("./constants");
const {
  isFriend,
  getUserIdByChatId,
  getDayText,
  getStatusText,
  getTimeIfTextIsCorrectTime,
  getTimeText,
} = require("./utils");
const users = require("./users");

const bot = new Telegraf(process.env.TG_API_TOKEN);
bot.use(session());

const sendMessageForDateChoose = async (ctx) => {
  await ctx.telegram.sendMessage(
    ctx.message.chat.id,
    `На какой время день вы хотите ометить <b>${getStatusText(ctx)}</b>.`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "На сейчас", callback_data: constants.forNow }],
          [{ text: "На сегодня", callback_data: constants.forToday }],
          [{ text: "На вчера", callback_data: constants.forYesterday }],
        ],
      },
      parse_mode: "HTML",
    }
  );
};

const sendAttendanceConfirm = async (ctx) => {
  const datetime = ctx.session?.dateTime ?? dayjs();
  await ctx.reply(
    `Вы уверены, что хотите отметить <b>${getStatusText(
      ctx
    )}</b> на <b>${getDayText(datetime)}</b> в <b>${getTimeText(
      datetime
    )}</b>? ⏰`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Да", callback_data: constants.confirm_yes }],
          [{ text: "Нет", callback_data: constants.confirm_no }],
        ],
      },
      parse_mode: "HTML",
    }
  );
};

const createAttendance = async (ctx, status, datetime) => {
  const chat_id =
    ctx.update?.callback_query?.message?.chat?.id ??
    ctx.update?.message?.chat?.id;
  console.log(
    ctx.update,
    chat_id,
    process.env.BASE_URL,
    getUserIdByChatId(chat_id)
  );
  if (chat_id) {
    axios
      .post(process.env.BASE_URL, {
        user_id: getUserIdByChatId(chat_id),
        status,
        datetime: new dayjs(datetime).format(),
      })
      .then(async () => {
        await ctx.reply(
          "🎉 Отлично, отметка успешно сохранена! Не забудьте заглянуть в Clockster, чтобы все было под контролем. 📅"
        );
        ctx.session = {};
      })
      .catch(async () => {
        await ctx.reply(
          "⚠ Упс! Что-то пошло не так... Попробуйте ещё раз или проверьте ваше интернет-соединение. 🌐"
        );
        ctx.session = {};
      });
    return;
  }
  await ctx.reply(
    "⚠ Упс! Что-то пошло не так... Попробуйте ещё раз или проверьте ваше интернет-соединение. 🌐"
  );
  ctx.session = {};
};

bot.start(async (ctx) => {
  if (isFriend(ctx.update.message.chat.id)) {
    await ctx.reply(
      "Здравствуйте! Я бот-альтернатива приложению QR-Track. Отмечайте своё присутствие прямо здесь, удобно и быстро! 😊",
      Markup.keyboard([["🌞 Приход"], ["🌙 Уход"]]).resize()
    );
  }
});
bot.hears(["🌞 Приход", "/in"], async (ctx) => {
  if (isFriend(ctx.update.message.chat.id)) {
    ctx.session = {};
    ctx.session.status = 1;
    await sendMessageForDateChoose(ctx);
  }
});

bot.hears(["🌙 Уход", "/out"], async (ctx) => {
  if (isFriend(ctx.update.message.chat.id)) {
    ctx.session = {};
    ctx.session.status = 0;
    await sendMessageForDateChoose(ctx);
  }
});
bot.hears(["/regreq"], async (ctx) => {
  try {
    const regReqData = await fsPromises.readFile("users.json", {
      encoding: "utf-8",
    });

    const regReqJson = JSON.parse(regReqData);
    let regReqs = [];

    if (
      regReqJson &&
      "users" in regReqJson &&
      Array.isArray(regReqJson["users"])
    ) {
      regReqs = regReqs.concat(Array.from(regReqJson["users"]));
      if (!regReqs.find((req) => req["id"] === ctx.chat.id)) {
        regReqs.push(ctx.chat);
        await fsPromises.writeFile(
          "users.json",
          JSON.stringify({ users: regReqs })
        );
      }
    } else {
      await fsPromises.writeFile("users.json", JSON.stringify({ users: [] }));
    }
  } catch (e) {
    console.log(e);
  }
});

bot.action(constants.forNow, async (ctx) => {
  if (isFriend(ctx.update.callback_query.message.chat.id)) {
    await ctx.answerCbQuery();
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    ctx.session = ctx.session || {};
    ctx.session.dateTime = new dayjs();
    await sendAttendanceConfirm(ctx);
  }
});

bot.action(constants.forToday, async (ctx) => {
  if (isFriend(ctx.update.callback_query.message.chat.id)) {
    await ctx.answerCbQuery();
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    ctx.session = ctx.session || {};
    ctx.session.dateTime = new dayjs();
    ctx.session.waitingTime = true;
    await ctx.reply(
      `Укажите время, на которое нужно зафиксировать отметку (<b>в формате чч:мм:сс или чч:мм</b>, например 18:10:02 или 18:10). Время должно быть <b>не ранее 24 часов назад</b> и <b>не позже текущего времени</b>. ⏰`,
      {
        parse_mode: "HTML",
      }
    );
  }
});
bot.action(constants.forYesterday, async (ctx) => {
  if (isFriend(ctx.update.callback_query.message.chat.id)) {
    await ctx.answerCbQuery();
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    ctx.session = ctx.session || {};
    ctx.session.dateTime = new dayjs().subtract(1, "day").add(1, "minute");
    ctx.session.waitingTime = true;
    await ctx.reply(
      `Укажите время, на которое нужно зафиксировать отметку (<b>в формате чч:мм:сс или чч:мм</b>, например 18:10:02 или 18:10). Время должно быть <b>не ранее 24 часов назад</b> и <b>не позже текущего времени</b>. ⏰`,
      {
        parse_mode: "HTML",
      }
    );
  }
});

bot.action(constants.confirm_yes, async (ctx) => {
  if (isFriend(ctx.update.callback_query.message.chat.id)) {
    await ctx.answerCbQuery();
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    if (ctx.session && "dateTime" in ctx.session && "status" in ctx.session) {
      await createAttendance(
        ctx,
        ctx.session.status,
        dayjs(ctx.session.dateTime)
      );
      return;
    }
    ctx.session = {};
    await ctx.reply(
      "⚠ Упс! Что-то пошло не так... Попробуйте ещё раз или проверьте, всё ли в порядке с интернетом."
    );
  }
});
bot.action(constants.confirm_no, async (ctx) => {
  if (isFriend(ctx.update.callback_query.message.chat.id)) {
    await ctx.answerCbQuery();
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    ctx.session = {};
    await ctx.reply(
      "Операция отменена. Вы можете попробовать снова или выбрать другой вариант. 🔄"
    );
  }
});

bot.command("wiz", async (ctx) => {
  if (isFriend(ctx.update.callback_query.message.chat.id)) {
    await ctx.reply(
      "Привет! 🌟 Что хотите отметить?",
      Markup.keyboard([["🌞 Приход"], ["🌙 Уход"]]).resize()
    );
  }
});
bot.on("text", async (ctx) => {
  if (isFriend(ctx.update.message.chat.id)) {
    if (ctx.session?.waitingTime) {
      const [isCorrectTime, timeObject] = getTimeIfTextIsCorrectTime(ctx);
      if (!isCorrectTime) {
        await ctx.reply(
          "Ошибка! Время введено неверно. Убедитесь, что оно в формате чч:мм:сс или чч:мм (например, 18:10:02 или 18:10). 🕰️"
        );
        return;
      }
      const target = new dayjs(ctx.session.dateTime)
        .hour(timeObject.hour)
        .minute(timeObject.minute)
        .second(timeObject.seconds);
      const twentyFourHourBefore = new dayjs().subtract(24, "hour");
      if (target.isBefore(twentyFourHourBefore) || target.isAfter(dayjs())) {
        await ctx.reply(
          "Ошибка! Время должно быть не ранее, чем 24 часа назад и не позже текущего времени. ⏳"
        );
        return;
      }
      ctx.session = ctx.session || {};
      ctx.session.waitingTime = false;
      ctx.session.dateTime = target;
      await sendAttendanceConfirm(ctx);
      return;
    }

    await ctx.reply(
      "Привет! 🌟 Что хотите отметить?",
      Markup.keyboard([["🌞 Приход"], ["🌙 Уход"]]).resize()
    );
  }
});

bot.launch();
