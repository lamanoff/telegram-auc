"""
Page Object Models для CryptoAuction Platform.
"""
from pages.base_page import BasePage
from pages.home_page import HomePage
from pages.login_page import LoginPage
from pages.register_page import RegisterPage
from pages.auctions_page import AuctionsPage
from pages.auction_detail_page import AuctionDetailPage
from pages.profile_page import ProfilePage
from pages.admin_page import AdminPage

__all__ = [
    "BasePage",
    "HomePage", 
    "LoginPage",
    "RegisterPage",
    "AuctionsPage",
    "AuctionDetailPage",
    "ProfilePage",
    "AdminPage"
]
