from PIL import Image

_session = None


def _remove(image):
    # Keep one ONNX model in memory. Creating a new rembg session for every
    # scan is the main reason phone uploads feel slow.
    global _session
    from rembg import new_session, remove
    if _session is None:
        _session = new_session("u2net_human_seg")
    return remove(image, session=_session)

def remove_background(input_path, output_path):
    image = Image.open(input_path)
    result = _remove(image)
    result.save(output_path)


def extract_garment(input_path, output_path, category=""):
    """Remove the scene, then retain the part of the person where the selected garment lives.

    A normal background-removal model returns the complete person. For wardrobe scans
    that is still noisy (face, trousers, shoes), so this makes a garment-focused crop.
    The user-selected category is deliberately used as the reliable body-region hint.
    """
    source = Image.open(input_path).convert("RGBA")
    # A 4K camera image adds latency without improving closet-card quality.
    source.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
    subject = _remove(source)
    alpha = subject.getchannel("A")
    bounds = alpha.getbbox()
    if not bounds:
        subject.save(output_path)
        return

    left, top, right, bottom = bounds
    width, height = right - left, bottom - top
    category = (category or "").lower()
    bottom_categories = ("jeans", "trousers", "shorts", "leggings", "palazzo")
    full_categories = ("dress", "saree", "co-ord", "ethnic")

    if any(value in category for value in full_categories):
        region = (left + int(width * .08), top + int(height * .10), right - int(width * .08), bottom - int(height * .02))
    elif any(value in category for value in bottom_categories):
        # Bottoms begin below the waist. Starting lower prevents the shirt or
        # jacket from leaking into jeans, trousers, shorts, and leggings.
        bottom_start = .56 if any(value in category for value in ("jeans", "trousers", "leggings", "palazzo")) else .52
        bottom_end = .86 if "shorts" in category else .98
        region = (left + int(width * .10), top + int(height * bottom_start), right - int(width * .10), top + int(height * bottom_end))
    else:
        # Tops: crop the upper torso, excluding the face and lower garments.
        region = (left + int(width * .14), top + int(height * .16), right - int(width * .14), top + int(height * .54))

    garment = subject.crop(region)
    garment_alpha = garment.getchannel("A")
    garment_bounds = garment_alpha.getbbox()
    if garment_bounds:
        padding = 18
        gl, gt, gr, gb = garment_bounds
        garment = garment.crop((max(0, gl - padding), max(0, gt - padding), min(garment.width, gr + padding), min(garment.height, gb + padding)))
    garment.save(output_path)
