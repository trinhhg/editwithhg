# v1.0 - Script gộp CSV vào JSON tĩnh - 2026-05-12
import json
import csv
import os

CORE_DICT_PATH = 'data/core_dict.json'
NEW_WORDS_PATH = 'data/new_words.csv'

def main():
    # 1. Đọc core_dict.json hiện tại (Nếu chưa có thì tạo mảng rỗng)
    if os.path.exists(CORE_DICT_PATH):
        with open(CORE_DICT_PATH, 'r', encoding='utf-8') as f:
            try:
                core_data = json.load(f)
            except json.JSONDecodeError:
                core_data = []
    else:
        core_data = []

    # Chuyển list thành dictionary để tra cứu & ghi đè (Key là tên gốc)
    dict_map = {item['name']: item for item in core_data}

    # 2. Đọc file new_words.csv mới push lên
    if os.path.exists(NEW_WORDS_PATH):
        with open(NEW_WORDS_PATH, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f) # Yêu cầu file CSV có dòng đầu là header
            for row in reader:
                name = row.get('name', '').strip()
                if not name:
                    continue
                
                # Xử lý aliases (tên gọi khác)
                aliases_raw = row.get('aliases', '')
                aliases = [a.strip() for a in aliases_raw.split(',') if a.strip()]

                # Cập nhật từ cũ hoặc thêm từ mới
                dict_map[name] = {
                    "id": row.get('id', f"ent-{hash(name)}"),
                    "name": name,
                    "type": row.get('type', 'character'),
                    "aliases": aliases,
                    "notes": row.get('notes', '')
                }

    # 3. Ghi lại vào core_dict.json
    updated_data = list(dict_map.values())
    # Đảm bảo thư mục data/ tồn tại
    os.makedirs(os.path.dirname(CORE_DICT_PATH), exist_ok=True)
    
    with open(CORE_DICT_PATH, 'w', encoding='utf-8') as f:
        json.dump(updated_data, f, ensure_ascii=False, indent=2)

    # 4. Làm rỗng file new_words.csv để đón đợt push tiếp theo
    with open(NEW_WORDS_PATH, 'w', encoding='utf-8') as f:
        f.write("id,name,type,aliases,notes\n")

    print(f"✅ Đã merge thành công! Tổng số thực thể hiện tại: {len(updated_data)}")

if __name__ == "__main__":
    main()
