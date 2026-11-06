// server/engine/cookingGuide.js — Family Pot Scaling (1..N Persons), Raw-to-Cooked Conversions & Clinical Cooking Guide

import { toEnDigits, toFaDigits, formatHalfFa } from "../../shared/persian.js";

export function generateCookingGuide({ slots = [], profile = {}, metrics = {}, persons = 1 }) {
  const N = Math.max(1, Math.min(20, Math.round(Number(persons) || 1)));
  const conditions = Array.isArray(profile.conditions) ? profile.conditions : [];
  const isDialysis = Boolean(profile.is_dialysis);
  const zeroOil = Boolean(metrics.zero_oil_cooking);
  const isAthlete = Boolean(profile.is_athlete);

  const reassurance_banner_fa = `✅ قانون طلایی بدون وسواس: تمام مقادیر داخل برنامه روزانه شما، مقدار «پخته و آماده مصرف سر سفره» برای ۱ نفر (شخص شما) است. جدول زیر صرفاً برای راحتی شما هنگام بستن قابلمه برای ${toFaDigits(N)} نفر تهیه شده است. از آنجا که ری کشیدن برنج و آب رفتن گوشت بسته به نوع ماده اولیه تقریبی است، اصلاً درگیر ترازوکشی وسواسی مواد خام نشوید؛ کافیست حدودِ جدول زیر را بپزید و سر سفره دقیقاً طبق قاشق و قوطی کبریتیِ برگه رژیم در بشقاب خودتان بکشید.`;

  const conversion_reference = [
    {
      category_fa: "برنج سفید یا سبوس‌دار",
      cooked_unit_fa: "هر ۴ قاشق غذاخوری برنج پخته (۱ واحد غلات ≈ ۱۰۰ گرم پخته)",
      raw_equiv_fa: "حدود ۳۲ گرم برنج خام (هر ۱ پیمانه پلوپز استاندارد ≈ ۱۶۰ گرم برنج خام ≈ ۲۰ قاشق غذاخوری پخته)",
    },
    {
      category_fa: "گوشت قرمز، مرغ و ماهی بی‌استخوان",
      cooked_unit_fa: "هر ۳۰ گرم گوشت/مرغ پخته (۱ قوطی کبریت)",
      raw_equiv_fa: "حدود ۴۰ گرم گوشت خام بی‌استخوان (ضریب تبدیل ۱.۳۵ به علت آب رفتن ۲۵ تا ۳۰ درصدی در پخت)",
    },
    {
      category_fa: "ماکارونی و پاستا",
      cooked_unit_fa: "هر ۱ لیوان ماکارونی پخته",
      raw_equiv_fa: "حدود ۶۵ تا ۷۰ گرم ماکارونی خشک خام (ضریب وزنی ~۲.۳)",
    },
    {
      category_fa: "حبوبات (عدس، لپه، لوبیا، نخود)",
      cooked_unit_fa: "هر نصف لیوان (۱ ملاقه متوسط) حبوبات پخته",
      raw_equiv_fa: "حدود ۳۵ تا ۴۰ گرم حبوبات خشک خام (ضریب وزنی ~۲.۴ پس از خیساندن و پخت)",
    },
    {
      category_fa: "سیب‌زمینی، تخم‌مرغ و نان",
      cooked_unit_fa: "وزن پخته آب‌پز / تنوری",
      raw_equiv_fa: "ضریب تبدیل ۱.۰ (وزن خام و پخته تقریباً برابر است)",
    },
  ];

  const family_pot_trick_fa =
    "🍲 ترفند طلایی دوگانه‌نپختن (وقتی اعضای خانواده غذای چرب‌تر می‌خورند): نیازی به پختن دو قابلمه جدا نیست! پیاز، گوشت و خورشت کل خانواده را ابتدا با مقدار کمِ روغن مجاز (به‌همراه کمی آب‌جوش و زردچوبه برای نرم و طلایی شدن پیاز بدون روغن زیاد — تکنیک تفت آبی) بپزید تا کاملاً جا بیفتد. در ۱۰ دقیقه پایانی پخت، سهم ۱ نفره خودتان را در ظرف جدا بکشید و سپس هر چقدر خواستید به قابلمه بقیه خانواده روغن یا کره اضافه کنید. برای برنج هم پیش از دادن روغن یا کره روی دیس خانواده، کفگیر سهم خودتان را ساده بردارید.";

  // Dynamic Condition-Specific Cooking Protocols
  const condition_protocols_fa = [];

  if (zeroOil || conditions.includes("fatty_liver") || conditions.includes("cholesterol") || conditions.includes("heart")) {
    condition_protocols_fa.push({
      title_fa: "پروتکل پخت ضدالتهاب (ویژه کبد چرب / چربی خون / سلامت قلب)",
      body_fa:
        "از تکنیک «تفت آبی» استفاده کنید: پیاز و مرغ را در قابلمه نچسب با ۲ قاشق آب‌جوش، زعفران و آبلیمو تفت دهید تا بدون سرخ شدن عمیق طلایی و خوش‌عطر شوند. پوست مرغ، چربی قابل رویت گوشت و روغن‌های جامد/حیوانی را پیش از پخت کاملاً حذف کنید. روغن زیتون فرابکر را هرگز روی شعله داغ نریزید؛ آن را پس از کشیدن غذا به صورت خام روی سالاد یا غذای ولرم بدهید.",
    });
  }

  if (conditions.includes("diabetes") || conditions.includes("insulin_resistance") || conditions.includes("pcos")) {
    condition_protocols_fa.push({
      title_fa: "پروتکل کنترل قند خون و شاخص گلیسمی (ویژه دیابت / مقاومت به انسولین / PCOS)",
      body_fa:
        "برنج و ماکارونی را با «دم کوتاه و به صورت دانه (Al dente)» بپزید و هرگز نگذارید شفته یا له شوند، زیرا شفته شدن نشاسته سرعت جهش قند خون را تا ۴۰٪ بالا می‌برد. سیب‌زمینی آب‌پز یا برنج را اجازه دهید کمی از داغی بیفتد (تشکیل نشاسته مقاوم). از رب‌های صنعتی شیرین پرهیز کرده و از سماق، آبغوره، شنبلیله و دارچین در پخت استفاده کنید.",
    });
  }

  if (conditions.includes("kidney") || isDialysis) {
    condition_protocols_fa.push({
      title_fa: "راهنمای پخت برای بیماری کلیوی",
      body_fa: "نمک و غذاهای فرآوری‌شده را محدود کنید. نیاز به محدودیت پتاسیم و فسفر و روش آماده‌سازی سبزیجات بر اساس آزمایش‌ها، مرحله بیماری و نظر تیم درمان تعیین می‌شود؛ هیچ ماده‌ای صرفاً به دلیل بیماری کلیه برای همه ممنوع نیست.",
    });
  }
  if (conditions.some(c => c.startsWith("stone_"))) {
    condition_protocols_fa.push({title_fa: "پیشگیری از سنگ کلیه", body_fa: "با توجه به نوع سنگ، آزمایش ادرار و بیماری‌های همراه، مایعات و نمک را با تیم درمان تنظیم کنید؛ در سنگ‌های کلسیمی کلسیم غذایی را خودسرانه حذف نکنید."});
  }

  if (conditions.includes("hypertension")) {
    condition_protocols_fa.push({
      title_fa: "پروتکل DASH و کنترل فشار خون در آشپزی",
      body_fa:
        "در ابتدای پخت نمک نریزید؛ تنها مقدار بسیار اندک نمک تصفیه‌شده یددار در ۱۰ دقیقه پایانی پخت مجاز است. نمکدان را از سفره حذف کرده و طعم غذا را با آبلیمو تازه، آبغوره بی‌نمک، سماق، پودر سیر، آویشن، مرزه و زیره تامین کنید.",
    });
  }

  if (conditions.includes("reflux")) {
    condition_protocols_fa.push({
      title_fa: "پروتکل آشپزی ملایم گوارشی (ویژه رفلاکس و معده حساس)",
      body_fa:
        "از پیازداغ سنگین، سیرداغ، نعناداغ، رب سرخ‌شده و فلفل تند پرهیز کنید. غذاها را به صورت آب‌پز ملایم، بخارپز یا تنوری طبخ نمایید.",
    });
  }

  if (isAthlete) {
    condition_protocols_fa.push({
      title_fa: "پروتکل آشپزی ورزشی (حفظ ارزش بیولوژیک پروتئین و ریکاوری)",
      body_fa:
        "سینه مرغ، ماهی و سفیده تخم‌مرغ را با حرارت ملایم (گریل مرطوب، بخارپز یا ایرفرایر) بپزید تا بافت پروتئین خشک و سفت نشود و سرعت هضم و جذب آمینواسیدها در وعده‌های قبل و بعد از تمرین حداکثر بماند.",
    });
  }

  if (condition_protocols_fa.length === 0) {
    condition_protocols_fa.push({
      title_fa: "پروتکل آشپزی سالم سفره ایرانی (حفظ ریزمغذی‌ها و طعم طبیعی)",
      body_fa:
        "استفاده از قابلمه نچسب یا استیل، پخت کم‌روغن به روش تفت آبی، استفاده از ادویه‌های طبیعی (زعفران، زردچوبه، زیره، دارچین و آبلیمو تازه) و پرهیز از سرخ کردن عمیق مواد غذایی.",
    });
  }

  // Generate itemized N-person scaling for every approved option across slots
  const items = [];

  for (const slot of slots) {
    for (const opt of slot.options || []) {
      const singleText = opt.scaled_ingredients_fa || "";
      const enText = toEnDigits(singleText).replace(/٫/g, ".");

      // Scale all numbers in singleText by N for cooked_family_total_fa
      const familyCookedText =
        N === 1
          ? singleText
          : toFaDigits(
              enText.replace(
                /(\d+(?:\.\d+)?)(\s*)(گرم|میل|عدد|تکه|برش|سیخ|سفیده|تخم‌مرغ|تخم مرغ|گردو|بادام|خرما|لیوان|پیاله|کاسه|کف دست|کف‌دست|قاشق|ق‌غ|ق‌م|ق‌چ|ق\.غ|ق\.م|ق\.چ|ملاقه|قوطی کبریت)/g,
                (m, numStr, sp, u) => {
                  const v = parseFloat(numStr) * N;
                  const r = v % 1 === 0 ? String(v) : v.toFixed(1);
                  return `${r}${sp}${u}`;
                }
              )
            );

      // Compute raw equivalents for the N-person pot
      const rawParts = [];

      // 1. Rice in tbsp -> raw rice in grams & rice cooker cups
      const riceMatch = enText.match(/(\d+(?:\.\d+)?)\s*(?:ق‌غ|ق\.غ|قاشق غذاخوری)\s*(?:برنج|عدس پلو|عدس‌پلو|لوبیا پلو|لوبیاپلو|سبزی پلو|باقالی پلو|دمی)/);
      if (riceMatch) {
        const tbsp1 = parseFloat(riceMatch[1]);
        const totalTbsp = tbsp1 * N;
        const rawRiceGrams = Math.round((totalTbsp / 4) * 32);
        const riceCups = Math.round((rawRiceGrams / 160) * 10) / 10;
        rawParts.push(
          `برنج خام برای ${toFaDigits(N)} نفر: حدود ${toFaDigits(rawRiceGrams)} گرم برنج خام (معادل حدود ${toFaDigits(riceCups)} پیمانه پلوپز؛ حاصل پس از پخت: ${toFaDigits(Math.round(totalTbsp))} قاشق غذاخوری پخته)`
        );
      }

      // 2. Cooked meat/chicken/fish in grams -> raw weight with 1.35 factor
      const meatMatch = enText.match(
        /(\d+(?:\.\d+)?)\s*گرم\s*(سینه مرغ|فیله یا سینه مرغ|مرغ|گوشت چرخ‌کرده|گوشت گوساله|گوشت خورشتی|گوشت|ماهی[^\(\+]*|بوقلمون|سینه جوجه|کباب[^\(\+]*)/
      );
      if (meatMatch) {
        const cookedG1 = parseFloat(meatMatch[1]);
        const cookedGN = Math.round(cookedG1 * N);
        const rawGN = Math.round((cookedGN * 1.35) / 5) * 5;
        const boxesN = formatHalfFa(cookedGN / 30);
        rawParts.push(
          `${meatMatch[2].trim()} خام برای ${toFaDigits(N)} نفر: حدود ${toFaDigits(rawGN)} گرم خام بی‌استخوان (ضریب ۱.۳۵ ← پس از پخت حدود ${toFaDigits(cookedGN)} گرم پخته معادل ${boxesN} قوطی کبریت می‌دهد)`
        );
      }

      // 3. Pasta in cups or grams -> dry pasta
      const pastaCupMatch = enText.match(/(\d+(?:\.\d+)?)\s*لیوان\s*(?:ماکارونی|پاستا)/);
      const pastaGramMatch = enText.match(/(\d+(?:\.\d+)?)\s*گرم\s*(?:ماکارونی|پاستا)/);
      if (pastaCupMatch) {
        const cupsN = parseFloat(pastaCupMatch[1]) * N;
        const dryG = Math.round(cupsN * 68);
        rawParts.push(
          `ماکارونی/پاستای خشک خام برای ${toFaDigits(N)} نفر: حدود ${toFaDigits(dryG)} گرم خشک (معادل ${formatHalfFa(cupsN)} لیوان پخته)`
        );
      } else if (pastaGramMatch) {
        const cookedG = parseFloat(pastaGramMatch[1]) * N;
        const dryG = Math.round(cookedG / 2.3);
        rawParts.push(
          `ماکارونی خشک خام برای ${toFaDigits(N)} نفر: حدود ${toFaDigits(dryG)} گرم خشک (معادل ${toFaDigits(Math.round(cookedG))} گرم پخته)`
        );
      }

      // 4. Legumes in cups/ladles/grams
      const legumeCupMatch = enText.match(/(\d+(?:\.\d+)?)\s*(?:لیوان|ملاقه)\s*(?:عدسی|عدس|خوراک لوبیا|دال عدس)/);
      if (legumeCupMatch) {
        const cupsN = parseFloat(legumeCupMatch[1]) * N;
        const dryG = Math.round(cupsN * 75);
        rawParts.push(
          `حبوبات خشک خام برای ${toFaDigits(N)} نفر: حدود ${toFaDigits(dryG)} گرم خشک (پس از خیساندن و پخت: ${formatHalfFa(cupsN)} لیوان پخته)`
        );
      }

      if (rawParts.length === 0) {
        rawParts.push(
          `مواد این وعده نیازی به تبدیل پیچیده خام‌به‌پخته ندارند؛ کافیست مقادیر ۱ نفره را ضربدر ${toFaDigits(N)} نمایید.`
        );
      }

      // Calculate N-person Pot Oil Allowance
      let pot_oil_allowance_fa = "";
      if (opt.oil_box && opt.oil_box.instruction_fa?.includes("روغن دیگری اضافه نشود")) {
        pot_oil_allowance_fa = "فقط همان روغن مندرج در مواد اولیه را برای هر نفر حساب کنید؛ روغن اضافی پیشنهاد نشده است.";
      } else if (zeroOil && opt.oil_box) {
        pot_oil_allowance_fa = "مقدار روغن را مطابق مواد همین گزینه و نسخه کارشناس برای تعداد افراد محاسبه کنید؛ از افزودن روغن جداگانه بدون محاسبه پرهیز کنید.";
      } else if (opt.oil_box) {
        const tspTotal = N * 5; // 5g (1 مرباخوری) per person
        const tbspEquiv = Math.round((tspTotal / 7.5) * 2) / 2;
        if (opt.oil_box.inline_print_phrase_fa.includes("سالاد")) {
          pot_oil_allowance_fa = `پخت غذا بدون روغن؛ مجموع روغن زیتون بکر خام روی سالاد برای ${toFaDigits(N)} نفر: ${toFaDigits(N)} قاشق مرباخوری (معادل حدود ${formatHalfFa(tbspEquiv)} قاشق غذاخوری استاندارد — روی شعله ریخته نشود).`;
        } else {
          pot_oil_allowance_fa = `مجموع روغن مجاز برای کل قابلمه ${toFaDigits(N)} نفره: ${toFaDigits(N)} قاشق مرباخوری (${toFaDigits(tspTotal)} گرم، معادل حدود ${formatHalfFa(tbspEquiv)} قاشق غذاخوری معمولی آشپزخانه از روغن کنجد، کلزا یا زیتون پخت‌وپز).`;
        }
      } else {
        pot_oil_allowance_fa = "این وعده سرد/بدون پخت است و نیاز به روغن پخت‌وپز ندارد.";
      }

      // Condition-specific prep note for this item
      let diet_specific_prep_fa = opt.preparation_fa || opt.oil_box?.instruction_fa || "پخت سالم و کم‌نمک مطابق دستور بالا.";
      if (isDialysis || conditions.includes("kidney")) {
        diet_specific_prep_fa +=
          " | ⚠️ نکته کلیوی: مقدار پتاسیم، فسفر، نمک و روش آماده‌سازی را بر اساس آزمایش و نسخه فردی بررسی کنید.";
      } else if (conditions.includes("diabetes") && riceMatch) {
        diet_specific_prep_fa +=
          " | ⚠️ نکته دیابت: برنج با دم کوتاه و کاملاً دانه (غیرشفته) پخته شود و نیم‌ساعت پیش از مصرف کمی از داغی بیفتد.";
      }

      items.push({
        slot_id: slot.slot_id,
        slot_title_fa: slot.title_fa,
        option_id: opt.option_id,
        option_title_fa: opt.title_fa,
        persons: N,
        cooked_single_share_fa: singleText,
        cooked_family_total_fa: familyCookedText,
        approx_raw_for_pot_fa: rawParts.join(" | "),
        pot_oil_allowance_fa,
        diet_specific_prep_fa,
      });
    }
  }

  return {
    persons: N,
    reassurance_banner_fa,
    conversion_reference,
    family_pot_trick_fa,
    condition_protocols_fa,
    items,
  };
}
