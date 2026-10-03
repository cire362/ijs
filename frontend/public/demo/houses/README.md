# Демонстрационные изображения домов

Изображения сгенерированы встроенным инструментом imagegen для тестовых объявлений «ИЖС платформа». Это вымышленные дома, а не фотографии выставленных на продажу объектов. Они хранятся локально, без запросов к фотобанкам.

Формат: WebP, ширина 1280 px, качество 84. Исходные PNG преобразованы только для уменьшения размера файлов.

Совместимость со старыми демо-данными реализована в `src/utils/propertyImages.ts`: четыре точных URL `/uploads/seed/prop-*.svg` отображаются через новые изображения и в карточке, и в галерее. Фотографии, загруженные пользователями, и отсутствующие фотографии не заменяются. Повторный запуск seed и изменение базы данных не требуются. Изображения служат оформлению демо-данных; их этажность и размеры не подтверждают характеристики тестовых объявлений.

## Финальные промпты

### plaster-house.webp

Create one landscape 3:2 photorealistic architectural real estate photograph, 1536x1024. For a Russian suburban individual housing demo catalog. Authentic plausible new detached home, professionally photographed with a full-frame camera, soft natural summer daylight, accurate materials and proportions, straight vertical lines. Three-quarter front view, entire building fits centrally with generous breathing room for cropping to 4:3 thumbnails, modest landscaped plot with lawn, birch or pine trees in the background, believable paved path and low planting. House occupies about 65 percent of frame, no extreme wide angle, no fake glossy CGI, no people, cars, text, signage, watermark, logos, montage or borders. This is a demo photograph, no branding. Subject: a tasteful affordable single-storey 130-square-meter house with warm white plaster walls, graphite metal gable roof, tall charcoal framed windows, sheltered entrance and a small terrace in natural oak. Fresh tidy grass and soft pale blue sky, calm editorial quality.

### brick-house.webp

Create one landscape 3:2 photorealistic architectural real estate photograph, 1536x1024. For a Russian suburban individual housing demo catalog. Authentic plausible new detached home, professionally photographed with a full-frame camera, soft natural summer daylight, accurate materials and proportions, straight vertical lines. Three-quarter front view, entire building fits centrally with generous breathing room for cropping to 4:3 thumbnails, modest landscaped plot with lawn, birch or pine trees in the background, believable paved path and low planting. House occupies about 65 percent of frame, no extreme wide angle, no fake glossy CGI, no people, cars, text, signage, watermark, logos, montage or borders. This is a demo photograph, no branding. Subject: a realistic two-storey 190-square-meter contemporary family cottage in warm red-brown brick, charcoal gable roof, restrained tall rectangular windows, oak entrance door, a modest front garden. Eye-level front corner view, blue sky with thin clouds.

### timber-house.webp

Create one landscape 3:2 photorealistic architectural real estate photograph, 1536x1024. For a Russian suburban individual housing demo catalog. Authentic plausible new detached home, professionally photographed with a full-frame camera, soft natural summer daylight, accurate materials and proportions, straight vertical lines. Three-quarter front view, entire building fits centrally with generous breathing room for cropping to 4:3 thumbnails, modest landscaped plot with lawn, birch or pine trees in the background, believable paved path and low planting. House occupies about 65 percent of frame, no extreme wide angle, no fake glossy CGI, no people, cars, text, signage, watermark, logos, montage or borders. This is a demo photograph, no branding. Subject: a beautiful compact single-storey 95-square-meter Scandinavian timber home clad in natural honey-colored larch, simple graphite standing seam pitched roof, large living room window, small timber deck, surrounding meadow grass and birch trees. Eye-level architectural photograph, warm but natural daylight.

### modern-house.webp

Create one landscape 3:2 photorealistic architectural real estate photograph, 1536x1024. For a Russian suburban individual housing demo catalog. Authentic plausible new detached home, professionally photographed with a full-frame camera, soft natural summer daylight, accurate materials and proportions, straight vertical lines. Three-quarter front view, entire building fits centrally with generous breathing room for cropping to 4:3 thumbnails, modest landscaped plot with lawn, birch or pine trees in the background, believable paved path and low planting. House occupies about 65 percent of frame, no extreme wide angle, no fake glossy CGI, no people, cars, text, signage, watermark, logos, montage or borders. This is a demo photograph, no branding. Subject: a tasteful single-storey contemporary 160-square-meter L-shaped house with a flat roof, pale stone and warm oak cladding, floor to ceiling dark-framed windows and sheltered patio. Moderate suburban plot with lawn and pines, no pool, no extravagant mansion, slightly elevated front corner view, soft sunny morning.

