from backend.controllers.category_controller import CategoryController
from backend.controllers.sub_category_controller import SubCategoryController
from backend.controllers.product_controller import ProductController
from backend.controllers.variant_group_controller import VariantGroupController
from backend.controllers.variant_value_controller import VariantValueController
from backend.controllers.kiosk_menu_controller import KioskMenuController


class AppApi:
    def __init__(self):
        self.category = CategoryController()
        self.sub_category = SubCategoryController()
        self.product = ProductController()
        self.variant_group = VariantGroupController()
        self.variant_value = VariantValueController()
        self.kiosk_menu = KioskMenuController()

