import json
import glob
import re
import html
import os

files = sorted(glob.glob('d:/inglyJon/scratch_repo/data/old-books/book*/data.json'))
all_words = []
global_id = 1

# Quick dictionary for basic Uzbek translations
uz_dict = {
    "afraid": "qo'rqqan, cho'chigan", "agree": "rozi bo'lmoq", "angry": "jahli chiqqan",
    "arrive": "yetib kelmoq", "attack": "hujum qilmoq", "bottom": "tubi, pastki qismi",
    "clever": "aqlli, ziyrak", "cruel": "shafqatsiz, zolim", "finally": "nihoyat",
    "hide": "yashirinmoq", "hunt": "ov qilmoq", "lot": "juda ko'p", "middle": "o'rtasi",
    "moment": "lahza", "pleased": "mamnun", "promise": "va'da bermoq", "reply": "javob bermoq",
    "safe": "xavfsiz", "trick": "hiyla, nayrang", "well": "yaxshi",
    "adventure": "sarguzasht", "approach": "yaqinlashmoq", "carefully": "ehtiyotkorlik bilan",
    "chemical": "kimyoviy modda", "create": "yaratmoq", "evil": "yomon, yovuz",
    "experiment": "tajriba", "kill": "o'ldirmoq", "laboratory": "laboratoriya",
    "laugh": "kulmoq", "loud": "baland (ovoz)", "nervous": "asabiy, hayajonlangan",
    "noise": "shovqin", "project": "loyiha", "scare": "qo'rqitmoq", "secret": "sir",
    "shout": "baqirmoq", "smell": "hidlamoq", "terrible": "dahshatli", "worse": "yomonroq"
}

movies = [
    ("Harry Potter", "Harry: \"Expecto Patronum!\""),
    ("Friends", "Joey: \"How you doin'?\""),
    ("Avengers: Endgame", "Tony: \"I love you 3000.\""),
    ("The Lion King", "Mufasa: \"Remember who you are.\""),
    ("Sherlock Holmes", "Sherlock: \"Elementary, my dear Watson.\""),
    ("Forrest Gump", "Forrest: \"Life is like a box of chocolates.\""),
    ("Spider-Man", "Peter: \"With great power comes great responsibility.\"")
]

for b_idx, fpath in enumerate(files, 1):
    data = json.load(open(fpath, encoding='utf-8'))
    units = [u for u in data.get('flashcard', []) if u.get('en', '').startswith('Unit')]
    for u_idx, u in enumerate(units, 1):
        for w_idx, w in enumerate(u.get('wordlist', [])):
            word_raw = w.get('en', '').strip()
            word_clean = re.sub(r'<[^>]+>', '', word_raw).strip().lower()
            pron = w.get('pron', '').strip()
            desc = html.unescape(re.sub(r'<[^>]+>', '', w.get('desc', ''))).strip()
            exam = html.unescape(re.sub(r'<[^>]+>', '', w.get('exam', ''))).strip()

            pos = 'noun'
            if ' v.' in pron or ' verb' in pron: pos = 'verb'
            elif ' adj.' in pron: pos = 'adj'
            elif ' adv.' in pron: pos = 'adv'
            elif ' prep.' in pron: pos = 'prep'
            elif ' pron.' in pron: pos = 'pron'
            elif ' conj.' in pron: pos = 'conj'

            ipa = re.sub(r'\s+(n|v|adj|adv|prep|pron|conj)\.?', '', pron).strip()
            if not ipa.startswith('/'):
                ipa = '/' + ipa.strip('[]') + '/'

            uzbek = uz_dict.get(word_clean, f"{word_clean} (tarjimada)")
            movie_choice = movies[(global_id - 1) % len(movies)]

            all_words.append({
                "id": global_id,
                "book": b_idx,
                "unit": u_idx,
                "word": word_clean,
                "ipa": ipa,
                "pos": pos,
                "uzbek": uzbek,
                "desc": desc,
                "exam": exam,
                "movie": movie_choice[0],
                "clip": movie_choice[1],
                "audio": w.get('audio', '')
            })
            global_id += 1

out_path = 'd:/inglyJon/admin/all_words.json'
with open(out_path, 'w', encoding='utf-8') as f:
    json.dump(all_words, f, ensure_ascii=False, indent=2)

print(f"Successfully compiled {len(all_words)} words across 6 books into {out_path}!")
