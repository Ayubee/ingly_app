import json
import re
import html
import os

source_path = "d:/inglyJon/scratch_repo/data/old-books/book1/data.json"
output_path = "d:/inglyJon/data/book1.json"

if not os.path.exists(source_path):
    print(f"Error: {source_path} not found")
    exit(1)

with open(source_path, "r", encoding="utf-8") as f:
    raw_data = json.load(f)

# Common Uzbek translations for Book 1 words
uz_translations = {
    # Unit 1
    "afraid": ("qo'rqqan, cho'chigan", "Biror kimsa qo'rqqanda, u xavf yoki vahimani his qiladi.", "Ayol ko'rgan narsasidan qo'rqib ketdi."),
    "agree": ("rozi bo'lmoq, fikriga qo'shilmoq", "Rozi bo'lmoq - 'ha' deb aytish yoki bir xil fikrlashdir.", "U restoranning taomi juda mazali ekaniga qo'shilaman."),
    "angry": ("jahli chiqqan, g'azablangan", "Birovning jahli chiqqanda, u baland ovozda gapirishi yoki urushishi mumkin.", "U uy vazifasini qilmadi, shuning uchun otasining jahli chiqdi."),
    "arrive": ("yetib kelmoq, kelmoq", "Yetib kelmoq - biror joyga borish yoki manzilga yetish.", "Ular avtobus bekatiga soat ikkida yetib kelishdi."),
    "attack": ("hujum qilmoq", "Hujum qilmoq - birovga zarar yetkazish uchun kurashga kirishmoq.", "Odam mayda qora qushning hujumiga uchradi."),
    "bottom": ("tubi, pastki qismi", "Tub - biror narsaning eng pastki qismidir.", "U tagidagi qutiga sho'ng'iganida, poyabzallarini taglikka qo'ydi."),
    "clever": ("aqlli, ziyrak", "Aqlli odamlar narsalarni tez va oson tushuna olishadi.", "Aqlli bola qiyin matematik misolni osonlikcha yechdi."),
    "cruel": ("shafqatsiz, zolim", "Shafqatsiz odamlar boshqalarga azob berishadi va pushaymon bo'lishmaydi.", "Zolim xo'jayin ishchilarini kun bo'yi tinimsiz ishlatdi."),
    "finally": ("nihoyat, oxir-oqibat", "Nihoyat - uzoq kutilgan vaqtdan so'ng biror narsa sodir bo'lishi.", "Uzoq safardan so'ng, nihoyat uyimizga yetib keldik."),
    "hide": ("yashirinmoq, berkinmoq", "Yashirinmoq - birov ko'rmaydigan joyga bekinish.", "Qiz do'stlaridan katta daraxt orqasiga berkinib oldi."),
    "hunt": ("ov qilmoq", "Ov qilmoq - hayvonlarni oziq-ovqat yoki sport uchun izlash va tutish.", "Qadimgi odamlar yashash uchun yovvoyi hayvonlarni ovlashgan."),
    "lot": ("juda ko'p, ko'p miqdorda", "Ko'p - biror narsaning katta miqdori yoki soni.", "Bog'da juda ko'p rang-barang gullar ochilib yotibdi."),
    "middle": ("o'rtasi, markazi", "O'rtasi - biror narsaning markaziy qismidir.", "Bola xonaning o'rtasida turib qo'shiq ayta boshladi."),
    "moment": ("lahza, bir zum", "Lahza - juda qisqa vaqt oralig'i.", "Bir lahzaga to'xtab, go'zal manzaraga qarab qoldim."),
    "pleased": ("mamnun, xursand", "Mamnun bo'lish - biror natijadan baxtiyor va rozi bo'lish.", "O'qituvchi a'lo baho olgan o'quvchisidan juda mamnun bo'ldi."),
    "promise": ("va'da bermoq", "Va'da bermoq - biror narsani albatta bajarishini aytish.", "U ertaga ertalab soat sakkizda kelishga va'da berdi."),
    "reply": ("javob bermoq", "Javob bermoq - berilgan savolga so'z yoki xat bilan javob qaytarish.", "Mening xatimga u darhol iliq javob qaytardi."),
    "safe": ("xavfsiz, bexatar", "Xavfsiz - hech qanday xavf yoki zarardan uzoq bo'lgan holat.", "Uyda o'tirganimizda o'zimizni to'liq xavfsiz his qilamiz."),
    "trick": ("hiyla, nayrang", "Hiyla - boshqalarni aldash yoki qiziqtirish uchun qilingan aqlli ish.", "Sehrgar tomoshabinlarga hayratlanarli hiyla ko'rsatdi."),
    "well": ("yaxshi, a'lo darajada", "Yaxshi - biror ishni sifatli va to'g'ri bajarish.", "U ingliz tilida juda yaxshi va ravon gapira oladi.")
}

def clean_text(t):
    if not t:
        return ""
    t = re.sub(r'<[^>]+>', '', t)
    t = html.unescape(t)
    return t.strip()

output_units = []
global_word_id = 1

for u_idx, unit in enumerate(raw_data.get("flashcard", []), 1):
    unit_title = clean_text(unit.get("en", f"Unit {u_idx}"))
    unit_image = unit.get("image", "")
    reading = unit.get("reading", {})
    if isinstance(reading, list) and len(reading) > 0:
        story_title = clean_text(reading[0].get("title", ""))
        story_text = clean_text(reading[0].get("text", ""))
    elif isinstance(reading, dict):
        story_title = clean_text(reading.get("title", ""))
        story_text = clean_text(reading.get("text", ""))
    else:
        story_title = ""
        story_text = ""

    words_list = []
    for w in unit.get("wordlist", []):
        word_en = clean_text(w.get("en", "")).lower()
        pron = clean_text(w.get("pron", ""))
        desc = clean_text(w.get("desc", ""))
        exam = clean_text(w.get("exam", ""))
        image = w.get("image", "")
        audio = w.get("audio", "")

        # Extract part of speech
        pos = "noun"
        if " v." in pron or " verb" in pron:
            pos = "verb"
        elif " adj." in pron or " adjective" in pron:
            pos = "adjective"
        elif " adv." in pron or " adverb" in pron:
            pos = "adverb"
        elif " prep." in pron or " preposition" in pron:
            pos = "preposition"
        elif " pron." in pron:
            pos = "pronoun"
        elif " conj." in pron:
            pos = "conjunction"

        # Clean IPA (remove part of speech from pron)
        ipa = re.sub(r'\s+(n|v|adj|adv|prep|pron|conj)\.?', '', pron).strip()
        if not ipa.startswith("/"):
            ipa = "/" + ipa.strip("[]") + "/"

        # Look up translation or fallback
        uz_word, uz_desc, uz_exam = uz_translations.get(word_en, (word_en, desc, exam))

        words_list.append({
            "id": global_word_id,
            "book": 1,
            "unit": u_idx,
            "word": word_en,
            "phonetic": ipa,
            "pos": pos,
            "uzbek": uz_word,
            "definition": desc,
            "definition_uz": uz_desc,
            "example": exam,
            "example_uz": uz_exam,
            "image_url": image,
            "audio_url": audio
        })
        global_word_id += 1

    output_units.append({
        "book": 1,
        "unit_number": u_idx,
        "title": unit_title,
        "story": {
            "title": story_title,
            "text": story_text
        },
        "words_count": len(words_list),
        "words": words_list
    })

dataset = {
    "book": 1,
    "total_units": len(output_units),
    "total_words": global_word_id - 1,
    "units": output_units
}

with open(output_path, "w", encoding="utf-8") as f:
    json.dump(dataset, f, ensure_ascii=False, indent=2)

print(f"Success! Processed {len(output_units)} units and {global_word_id - 1} words into {output_path}")
