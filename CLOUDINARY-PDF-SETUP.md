# Cloudinary PDF delivery setup

New PDFs are uploaded as Cloudinary `image` resources so Cloudinary can generate a first-page image preview. The recipient’s Download PDF action uses Cloudinary’s attachment-delivery flag.

If the Cloudinary product environment is on the Free plan, PDF delivery is blocked by default. In the Cloudinary Console, open **Settings → Security** and enable **Allow delivery of PDF and ZIP files**. This account-level setting cannot be changed from the chat application. Cloudinary notes that browsers or CDNs may cache an earlier blocked response, so allow the cache to expire or invalidate the asset after enabling the option. [1]

Cloudinary documents that PDFs can be uploaded as image assets and that individual pages can be delivered as images. Its attachment flag forces a delivery URL to download instead of embedding the file. [2] [3]

## References

[1]: https://cloudinary.com/documentation/image_delivery_options "Image optimization and delivery"
[2]: https://cloudinary.com/documentation/paged_and_layered_media "PDF and Photoshop files"
[3]: https://cloudinary.com/documentation/transformation_reference_fl_flag_attachment "Attachment flag"
